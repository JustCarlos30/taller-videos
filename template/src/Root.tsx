import {Composition} from 'remotion';
import {Film} from './Film';
import video from '../video.json';
import props from '../props.json';
export const Root = () => <Composition id={video.composition} component={Film}
  width={video.width} height={video.height} fps={video.fps}
  durationInFrames={video.durationInFrames} defaultProps={props} />;
