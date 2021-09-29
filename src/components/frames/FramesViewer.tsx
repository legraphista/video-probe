import React from 'react'
import {observer} from "mobx-react";
import {AppState} from "../../AppState";
import * as Highcharts from 'highcharts';
import HighchartsReact from "highcharts-react-official";
import {FramePictType} from "../../helpers/FFprobe";

export const FramesViewer = observer(function FramesViewer() {
  const framesGop = AppState.ffprobe.fileFramesGop;
  if (!framesGop?.frames.length) return null;

  const frames = framesGop.frames;

  const options: Highcharts.Options = {
    title: {
      text: 'Frames'
    },
    tooltip: {
      valueDecimals: 2,
      changeDecimals: 2
    },
    chart: {
      zoomType: 'x',
    },
    yAxis: [
      {
        type: 'logarithmic',
        title: {
          text: 'Frame size & Type'
        },
        zoomEnabled: true
      },
    ],
    series: [{
      yAxis: 0,
      type: 'column',
      name: 'Frame size',
      data: frames.map((f, i) => {
        return {
          y: f.pkt_size,
          x: i,
          color: f.pict_type === FramePictType.I ? 'blue' :
            f.pict_type === FramePictType.P ? 'red' :
              'grey',
          name: String.fromCharCode(f.pict_type)
        }
      })
    }]
  }

  return (
    <div
      style={{
        width: "100%",
      }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
      />
    </div>
  )
})
