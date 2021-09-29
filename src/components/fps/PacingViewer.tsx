import React from 'react'
import {observer} from "mobx-react";
import {AppState} from "../../AppState";
import * as Highcharts from 'highcharts';
import HighchartsReact from "highcharts-react-official";
import Fraction from "fraction.js";

export const PacingViewer = observer(function PacingViewer() {
  const pacing = AppState.ffprobe.pacing;
  if (!pacing?.[0]) return null;

  const packets = AppState.ffprobe.streamPackets![0];

  const options: Highcharts.Options = {
    title: {
      text: 'Pacing'
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
        title:{
          text:  'PTS Diff'
        },
        opposite: true,
        zoomEnabled: true
      },
      {
        title: {
          text: 'FPS'
        },
        zoomEnabled: true
      }
    ],
    series: [{
      yAxis: 0,
      type: 'line',
      name: 'PTS Diff',
      data: packets.map((p, i) => {
        if (i === 0) return [p.pts_time, 0];

        return [p.pts_time, p.pts - packets[i - 1].pts];
      }).slice(1)
    }, {
      yAxis: 1,
      type: 'line',
      name: 'FPS',
      data: packets.map((p, i) => {
        if (i === 0) return [p.pts_time, 0];

        return [p.pts_time, new Fraction(1, (p.pts_time - packets[i - 1].pts_time)).round(6).valueOf()];
      }).slice(1)
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
