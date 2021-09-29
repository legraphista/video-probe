import React from 'react'
import {observer} from "mobx-react";
import {AppState} from "../../AppState";
import HighchartsReact from "highcharts-react-official";
import * as Highcharts from "highcharts";
import {bitsToString, GBits, KBits, MBits, secondsToTime} from "../../helpers/units";

export const BitRateViewer = observer(function BitRateViewer() {
  const br = AppState.ffprobe.bitrate;
  if (!br) return null;

  const options: Highcharts.Options = {
    title: {
      text: 'Bitrate'
    },
    tooltip: {
      valueDecimals: 2,
      formatter: function () {
        return `${bitsToString(this.y)}/s at ${secondsToTime(this.x)}`
      }
    },
    chart: {
      zoomType: 'x',
    },
    yAxis: [
      {
        title: {
          text: 'Bitrate'
        },
        zoomEnabled: true,
        min: 1,
        // type: 'logarithmic',
        labels: {
          formatter: function () {

            const maxElement = this.axis.getExtremes().dataMax;
            if (maxElement > GBits) {
              // @ts-ignore
              return (this.value / GBits).toFixed(1) + " GBit/s";
            } else if (maxElement > MBits) {
              // @ts-ignore
              return (this.value / MBits).toFixed(1) + " MBit/s";
            } else if (maxElement > KBits) {
              // @ts-ignore
              return (this.value / KBits).toFixed(1) + " KBit/s";
            } else {
              return (this.value) + " Bit/s";
            }
          }
        }

      },
    ],
    series: [{
      yAxis: 0,
      type: 'area',
      name: 'Bits/s',
      data: br.map((x, i) => [i, Math.max(x, 1)]),
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
