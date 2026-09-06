declare module 'react-native-keep-awake' {
  import { Component } from 'react';

  export default class KeepAwake extends Component<{}> {
    static activate(): void;
    static deactivate(): void;
  }
}
