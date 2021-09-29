import {makeObservable, observable} from "mobx";
import {FFprobe} from "./helpers/FFprobe";

class AppStateClass {

  @observable.ref
  readonly ffprobe = new FFprobe();

  constructor() {
    makeObservable(this);
  }

}

export const AppState = new AppStateClass();

// @ts-ignore
window.AppState = AppState;
