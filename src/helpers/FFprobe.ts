import {action, computed, makeObservable, observable, reaction} from "mobx";
import {v4 as uuid} from 'uuid';
import Fraction from "fraction.js";
import {lastOf} from "./array";

const worker = new Worker('ffprobe-worker.js');

export type Stream = {
  id: number
  start_time: number;
  duration: number;
  codec_type: number;
  codec_type_name: string;
  codec_name: string;
  format: string;
  bit_rate: string;
  profile: string;
  level: number;
  width: number;
  height: number;
  channels: number;
  sample_rate: number;
  frame_size: number;
  time_base: number;
}

export enum FramePictType {
  I = 73,
  P = 80,
  B = 66,
  S = 83,
  i = 105,
  p = 112,
  b = 98,
  Unknown = 63
}

export type Frame = {
  frame_number: number;
  pict_type: FramePictType;
  pts: number;
  dts: number;
  pos: number;
  pkt_size: number;
}

export type FileInfoResponse = {
  name: string;
  bit_rate: number;
  duration: number;
  url: string;
  nb_streams: number;
  flags: number;
  streams: Stream[];
}

export type FramesResponse = {
  frames: Frame[];
  nb_frames: number;
  gop_size: number;
  duration: number;
  time_base: number;
}

export type Packet = {
  stream_index: number;
  pts: number;
  dts: number;
  duration: number;
  size: number;
  pos: number;
  key_frame: boolean;
  discard_frame: boolean;
  corrupt_frame: boolean;
}

export type PacketsResponse = {
  packets: Packet[];
  nb_packets: number;
};

type GetFileInfoMessageEvent = {
  type: 'get_file_info',
  nonce: string,
  versions: {
    libavutil: string
    libavcodec: string,
    libavformat: string,
  }
} & FileInfoResponse;

type GetFramesMessageEvent = {
  type: 'get_frames',
  nonce: string
} & FramesResponse

type GetPacketsMessageEvent = {
  type: 'get_packets',
  nonce: string
} & PacketsResponse

type AnyMessageEvent = GetFileInfoMessageEvent | GetFramesMessageEvent | GetPacketsMessageEvent;

type EnhancedPacket = Packet & {
  pts_time: number,
  dts_time: number
}


export class FFprobe {

  @observable.ref
  file: File | null = null;

  @observable.ref
  fileInfo: FileInfoResponse | null = null;

  @observable.ref
  filePackets: PacketsResponse | null = null;

  @observable.ref
  fileFramesGop: FramesResponse | null = null;

  @computed get timebase(): null | Fraction[] {
    if (!this.fileInfo) return null;

    return this.fileInfo.streams.map(s => new Fraction(s.time_base));
  }

  @computed get streamPackets(): null | EnhancedPacket[][] {

    if (!this.fileInfo || !this.filePackets) return null;

    const timebases = this.timebase;
    if (!timebases) return null;

    const streams: EnhancedPacket[][] = new Array(this.fileInfo.nb_streams).fill(0).map(() => []);

    const packets = this.filePackets.packets;
    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const si = packet.stream_index;

      streams[si].push(
        Object.assign(
          {
            pts_time: timebases[si].mul(packet.pts).valueOf(),
            dts_time: timebases[si].mul(packet.dts).valueOf()
          },
          packet
        ));
    }

    streams.forEach(s => s.sort((a, b) => a.pts - b.pts));

    return streams;
  }

  @computed get gop(): null | number[] {
    const streamPackets = this.streamPackets;
    if (!streamPackets) return null;

    return streamPackets.map((packets, si) => {
      const first_KF = packets.findIndex(x => x.key_frame);
      if (first_KF === -1) return 0;

      const second_KF = packets.slice(first_KF + 1).findIndex(x => x.key_frame);
      if (second_KF === -1) return packets.length;

      return second_KF - first_KF;
    });
  }

  @computed get bitratePerStream() {
    const streamPackets = this.streamPackets;
    if (!streamPackets) return null;

    const bitratePerSecondPerStream: number[][] = streamPackets.map(s =>
      new Array(Math.ceil(s[s.length - 1].pts_time)).fill(0)
    )

    streamPackets.forEach((packets, si) => {

      for (let i = 0; i < packets.length; i++) {
        const p = packets[i];
        bitratePerSecondPerStream[si][Math.floor(p.pts_time)] += p.size;
      }
    });

    return bitratePerSecondPerStream;
  }

  @computed get bitrate() {
    const { bitratePerStream } = this;
    if (!bitratePerStream) return null;

    const maxDuration = Math.max(...bitratePerStream.map(x => x.length));
    const bitrate = new Array(maxDuration).fill(0);

    for (let si = 0; si < bitratePerStream.length; si++) {
      const s = bitratePerStream[si];
      for (let i = 0; i < s.length; i++) {
        bitrate[i] += s[i];
      }
    }
    return bitrate;
  }

  @computed get pacing(): null | {
    begin_index: number,
    end_index: number,
    duration_between: number
  }[][] {
    const streamPackets = this.streamPackets;
    if (!streamPackets) return null;

    return streamPackets.map(stream => {

      if (stream.length < 2) {
        return [{
          begin_index: 0,
          end_index: 0,
          duration_between: 0
        }];
      }

      const ranges: { begin_index: number, end_index: number, duration_between: number }[] = [{
        begin_index: 0,
        end_index: 1,
        duration_between: stream[1].pts - stream[0].pts
      }];


      for (let i = 2; i < stream.length; i++) {
        const A = stream[i - 1];
        const B = stream[i];
        const diff = B.pts - A.pts;

        if (lastOf(ranges).duration_between === diff) {
          lastOf(ranges).end_index = i;
        } else {
          ranges.push({
            begin_index: i - 1,
            end_index: i,
            duration_between: diff
          });
        }
      }

      return ranges;
    })
  }

  constructor() {
    makeObservable(this);

    reaction(
      () => this.file,
      () => {
        this.setFileInfo(null);
        this.computeInfo()
          .then(this.setFileInfo)
          .catch(console.error);
      }
    );
    reaction(
      () => this.file,
      () => {
        this.setFilePackets(null);
        this.computePackets()
          .then(this.setFilePackets)
          .catch(console.error);
      }
    );
    reaction(
      () => this.file,
      () => {
        this.setFileFramesGop(null);
        this.computeFramesGop(0)
          .then(this.setFileFramesGop)
          .catch(console.error);
      }
    );
  }

  @action setFileInfo = (data: FFprobe['fileInfo']) => this.fileInfo = data;
  @action setFilePackets = (data: FFprobe['filePackets']) => this.filePackets = data;
  @action setFileFramesGop = (data: FFprobe['fileFramesGop']) => this.fileFramesGop = data;
  @action setFile = (data: FFprobe['file']) => this.file = data;

  computeInfo = async () => {
    if (!this.file) {
      console.warn('refusing to work on empty file');
      return null;
    }

    const nonce = uuid();
    const timeKey = `Computing Info for ${this.file.name} ${nonce}`;
    console.time(timeKey);
    worker.postMessage(['get_file_info', nonce, this.file]);

    return new Promise<FileInfoResponse>((res, rej) => {

      function computeInfoReturn(this: typeof worker, e: MessageEvent<AnyMessageEvent>) {
        const data = e.data;
        if (data.nonce !== nonce || data.type !== 'get_file_info') return;

        worker.removeEventListener('message', computeInfoReturn);

        console.timeEnd(timeKey);
        return res(data);
      }

      worker.addEventListener('message', computeInfoReturn);

    });
  }

  computePackets = async () => {
    if (!this.file) {
      console.warn('refusing to work on empty file');
      return null;
    }

    const nonce = uuid();
    const timeKey = `Computing Packets for ${this.file.name} ${nonce}`;
    console.time(timeKey);
    worker.postMessage(['get_packets', nonce, this.file]);

    return new Promise<PacketsResponse>((res, rej) => {

      function computeInfoReturn(this: typeof worker, e: MessageEvent<AnyMessageEvent>) {
        const data = e.data;
        if (data.nonce !== nonce || data.type !== 'get_packets') return;

        worker.removeEventListener('message', computeInfoReturn);

        console.timeEnd(timeKey);
        return res(data);
      }

      worker.addEventListener('message', computeInfoReturn);

    });
  }

  computeFramesGop = async (fromPTS: number) => {
    if (!this.file) {
      console.warn('refusing to work on empty file');
      return null;
    }

    const nonce = uuid();
    const timeKey = `Computing Frames from ${fromPTS} for ${this.file.name} ${nonce}`;
    console.time(timeKey);
    worker.postMessage(['get_frames', nonce, this.file, Math.floor(fromPTS)]);

    return new Promise<FramesResponse>((res, rej) => {

      function computeInfoReturn(this: typeof worker, e: MessageEvent<AnyMessageEvent>) {
        const data = e.data;
        if (data.nonce !== nonce || data.type !== 'get_frames') return;

        worker.removeEventListener('message', computeInfoReturn);

        console.timeEnd(timeKey);
        return res(data);
      }

      worker.addEventListener('message', computeInfoReturn);

    });
  }


}
