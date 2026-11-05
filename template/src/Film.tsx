import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

type Props = {title: string; subtitle: string; accent: string};
export const Film = ({title, subtitle, accent}: Props) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  const reveal = interpolate(t, [0, 0.28], [0, 1], {extrapolateRight: 'clamp'});
  const turn = interpolate(t, [0, 1], [-35, 65]);
  return <AbsoluteFill style={{backgroundColor: '#123f70', color: '#fff9eb', overflow: 'hidden', fontFamily: 'DejaVu Sans, sans-serif'}}>
    <svg viewBox="0 0 960 540" width={width} height={height} preserveAspectRatio="none" style={{position: 'absolute'}}>
      <circle cx={790} cy={265} r={175} fill={accent} />
      <g transform={`translate(790 265) rotate(${turn})`}>
        <rect x={-92} y={-240} width={184} height={480} rx={92} fill="#d7ef72" />
        <circle cx={0} cy={0} r={72} fill="#123f70" />
      </g>
      <path d={`M 60 440 H ${60 + 500 * t}`} stroke="#d7ef72" strokeWidth={6} />
    </svg>
    <div style={{position: 'absolute', left: '6.25%', top: '25%', width: '60%', transform: `translateY(${24 * (1 - reveal)}px)`, opacity: 0.2 + 0.8 * reveal}}>
      <h1 style={{fontSize: width * 0.066, lineHeight: 1.08, letterSpacing: '-0.03em', margin: 0, fontWeight: 700, maxWidth: '11ch', overflowWrap: 'anywhere'}}>{title}</h1>
      <p style={{fontSize: width * 0.023, lineHeight: 1.45, marginTop: height * 0.055, maxWidth: '29ch'}}>{subtitle}</p>
    </div>
    <div style={{position: 'absolute', bottom: '8%', right: '6%', fontSize: width * 0.016, fontVariantNumeric: 'tabular-nums'}}>TALLER / EN MOVIMIENTO</div>
  </AbsoluteFill>;
};
