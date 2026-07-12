export const VERTEX_SHADER = `#version 300 es
precision highp float;

void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const DEFAULT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

out vec4 outColor;

uniform vec2 uResolution;
uniform vec4 uPointer;
uniform float uTime;
uniform float uSeed;
uniform float uSpeed;
uniform float uMotion;
uniform float uScale;
uniform float uZoom;
uniform float uRotation;
uniform float uWarp;
uniform float uTurbulence;
uniform float uDetail;
uniform float uSymmetry;
uniform float uTwist;
uniform float uDensity;
uniform float uSoftness;
uniform float uContour;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uGlow;
uniform float uGrain;
uniform float uVignette;
uniform float uHue;
uniform float uLightAngle;
uniform float uPointerForce;
uniform float uPixelate;
uniform float uAberration;
uniform int uStyle;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rotate2d(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345 + uSeed * 0.001);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 octaveRotation = rotate2d(0.57);
  for (int i = 0; i < 7; i++) {
    if (float(i) >= uDetail) break;
    value += amplitude * noise2(p);
    p = octaveRotation * p * (1.93 + uTurbulence * 0.12) + 17.17;
    amplitude *= 0.51;
  }
  return value;
}

float voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash21(n + g), hash21(n + g + 9.31));
      o = 0.5 + 0.5 * sin(uTime * uSpeed * 0.6 + TAU * o);
      md = min(md, dot(g + o - f, g + o - f));
    }
  }
  return sqrt(md);
}

vec3 palette(float t) {
  t = fract(t + uHue);
  if (t < 0.333333) return mix(uColor0, uColor1, smoothstep(0.0, 0.333333, t));
  if (t < 0.666666) return mix(uColor1, uColor2, smoothstep(0.333333, 0.666666, t));
  return mix(uColor2, uColor3, smoothstep(0.666666, 1.0, t));
}

float fieldAt(vec2 fragCoord) {
  vec2 resolution = max(uResolution, vec2(1.0));
  if (uPixelate > 0.5) {
    float block = 1.0 + uPixelate * 0.75;
    fragCoord = floor(fragCoord / block) * block + block * 0.5;
  }
  vec2 p = (fragCoord * 2.0 - resolution) / min(resolution.x, resolution.y);
  p /= max(uZoom, 0.08);
  p = rotate2d(uRotation) * p;

  vec2 pointer = uPointer.xy;
  float pointerDistance = length(p - pointer);
  float pointerEnvelope = exp(-pointerDistance * (2.2 + 4.0 * (1.0 - uPointer.z)));
  p += normalize(p - pointer + 0.0001) * pointerEnvelope * uPointerForce * (0.16 + uPointer.w * 0.7);

  float radius = length(p);
  float angle = atan(p.y, p.x);
  float sectors = max(1.0, floor(uSymmetry + 0.5));
  float sector = TAU / sectors;
  angle = mod(angle + sector * 0.5, sector) - sector * 0.5;
  angle = abs(angle);
  angle += radius * radius * uTwist * 2.7;
  p = vec2(cos(angle), sin(angle)) * radius;

  float time = uTime * uSpeed;
  vec2 drift = vec2(cos(time * 0.29), sin(time * 0.23)) * uMotion;
  vec2 warpA = vec2(fbm(p * (1.5 + uScale * 0.22) + drift), fbm(p * 1.73 - drift + 7.7));
  vec2 q = p + (warpA - 0.5) * uWarp * 1.8;

  float base = 0.0;
  if (uStyle == 0) {
    float waves = sin((q.x + fbm(q * 1.7 + time * 0.12)) * uDensity + time);
    base = 0.52 + 0.32 * waves + 0.38 * fbm(q * uScale - drift);
  } else if (uStyle == 1) {
    float cells = voronoi(q * (uScale + 1.2));
    base = 1.0 - smoothstep(0.08, 0.78 + uSoftness, cells) + fbm(q * 2.0) * 0.35;
  } else if (uStyle == 2) {
    float terrain = fbm(q * uScale + drift * 0.4) * uDensity;
    float lines = abs(fract(terrain) - 0.5);
    base = 1.0 - smoothstep(0.02, 0.07 + uSoftness * 0.22, lines);
    base += fbm(q * 0.9 - drift) * uContour;
  } else if (uStyle == 3) {
    float ring = sin((length(q) + fbm(q * 2.3) * uWarp * 0.32) * uDensity * 2.4 - time * 1.7);
    float spokes = cos(atan(q.y, q.x) * max(2.0, uSymmetry) + time * 0.4);
    base = 0.5 + 0.34 * ring + 0.19 * spokes;
  } else {
    float a = sin(q.x * uDensity + time + fbm(q * 1.4) * 4.0);
    float b = cos(q.y * (uDensity * 0.82) - time * 0.73 + fbm(q.yx * 2.1) * 3.0);
    base = 0.5 + 0.28 * a + 0.28 * b + 0.22 * sin((q.x + q.y) * uScale * 3.0);
  }

  return base;
}

void main() {
  float field = fieldAt(gl_FragCoord.xy);
  float dx = dFdx(field);
  float dy = dFdy(field);
  vec3 normal = normalize(vec3(-dx * 7.0, -dy * 7.0, 1.0));
  vec3 lightDirection = normalize(vec3(cos(uLightAngle), sin(uLightAngle), 0.72));
  float diffuse = max(0.0, dot(normal, lightDirection));

  float contour = smoothstep(0.48 - uSoftness * 0.3, 0.52 + uSoftness * 0.3, fract(field * (1.0 + uContour * 3.0)));
  float palettePosition = field * (0.78 + uContour * 0.34) + diffuse * 0.18;
  vec3 color = palette(palettePosition);
  color *= 0.62 + diffuse * 0.68;
  color += palette(palettePosition + 0.23) * contour * uGlow * 0.28;

  float edgeGlow = pow(clamp(length(vec2(dx, dy)) * 5.5, 0.0, 1.0), 0.6);
  color += palette(field + 0.4) * edgeGlow * uGlow * 0.72;

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);
  color = (color - 0.5) * uContrast + 0.5;
  color *= uExposure;
  color = color / (1.0 + color);

  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float aberration = (uv.x - 0.5) * uAberration * 0.025;
  color.r *= 1.0 + aberration;
  color.b *= 1.0 - aberration;
  float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  color *= mix(1.0 - uVignette, 1.0, smoothstep(0.0, 0.0625, vignette));
  color += (hash21(gl_FragCoord.xy + uTime) - 0.5) * uGrain;
  color = pow(max(color, 0.0), vec3(0.4545));

  outColor = vec4(color, 1.0);
}
`;
