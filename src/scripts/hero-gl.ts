/**
 * Hero slideshow: a circular lens grows from the center, refracting and splitting
 * the next image's color channels at its rim, until it covers the frame.
 * Loaded on demand by motion.ts only when the hero has two or more slides.
 */
import gsap from "gsap";
import {
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  type Texture,
} from "three";

const frag = /* glsl */ `
  uniform sampler2D uTexture1, uTexture2;
  uniform float uProgress;
  uniform vec2 uResolution, uTexture1Size, uTexture2Size;
  varying vec2 vUv;
  vec2 coverUV(vec2 uv, vec2 ts) {
    vec2 s = uResolution / ts;
    float sc = max(s.x, s.y);
    vec2 sz = ts * sc;
    // Centered horizontally, pinned to the top (matches the <img>'s object-position: top),
    // so the photo doesn't shift when the WebGL layer takes over.
    vec2 o = vec2((uResolution.x - sz.x) * 0.5, uResolution.y - sz.y);
    return (uv * uResolution - o) / sz;
  }
  void main() {
    float time = uProgress * 5.0;
    vec2 uv1 = coverUV(vUv, uTexture1Size);
    vec2 uv2 = coverUV(vUv, uTexture2Size);
    float maxR = length(uResolution) * 0.85;
    float br = uProgress * maxR;
    vec2 p = vUv * uResolution;
    vec2 c = uResolution * 0.5;
    float d = length(p - c);
    float nd = d / max(br, 0.001);
    float inside = smoothstep(br + 3.0, br - 3.0, d);
    vec4 img;
    if (inside > 0.0) {
      float ro = 0.08 * pow(smoothstep(0.3, 1.0, nd), 1.5);
      vec2 dir = (d > 0.0) ? (p - c) / d : vec2(0.0);
      vec2 duv = uv2 - dir * ro;
      duv += vec2(sin(time + nd * 10.0), cos(time * 0.8 + nd * 8.0)) * 0.015 * nd * inside;
      float ca = 0.02 * pow(smoothstep(0.3, 1.0, nd), 1.2);
      img = vec4(texture2D(uTexture2, duv + dir * ca * 1.2).r, texture2D(uTexture2, duv + dir * ca * 0.2).g, texture2D(uTexture2, duv - dir * ca * 0.8).b, 1.0);
      float rim = smoothstep(0.95, 1.0, nd) * (1.0 - smoothstep(1.0, 1.01, nd));
      img.rgb += rim * 0.08;
    } else { img = texture2D(uTexture2, uv2); }
    if (uProgress > 0.95) img = mix(img, texture2D(uTexture2, uv2), (uProgress - 0.95) / 0.05);
    gl_FragColor = mix(texture2D(uTexture1, uv1), img, inside);
  }`;
const vert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;

export async function heroGL(canvas: HTMLCanvasElement, section: HTMLElement, slides: string[], onChange: (index: number) => void) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // the canvas spans the whole (tall) hero track
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const u = {
    uTexture1: { value: null as Texture | null },
    uTexture2: { value: null as Texture | null },
    uProgress: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uTexture1Size: { value: new Vector2(1, 1) },
    uTexture2Size: { value: new Vector2(1, 1) },
  };
  scene.add(new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag })));
  const render = () => renderer.render(scene, camera);
  const size = () => {
    const r = section.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    u.uResolution.value.set(r.width, r.height);
    render();
  };

  const loader = new TextureLoader();
  const load = (src: string) =>
    new Promise<Texture | null>((res) =>
      loader.load(src, (t) => {
        t.minFilter = t.magFilter = LinearFilter;
        const img = t.image as HTMLImageElement;
        t.userData = { size: new Vector2(img.width, img.height) };
        res(t);
      }, undefined, () => res(null)),
    );
  const tex = (await Promise.all(slides.map(load))).filter(Boolean) as Texture[];
  if (tex.length < 2) return renderer.dispose();

  const pair = (a: number, b: number) => {
    u.uTexture1.value = tex[a];
    u.uTexture1Size.value = tex[a].userData.size;
    u.uTexture2.value = tex[b];
    u.uTexture2Size.value = tex[b].userData.size;
  };
  let idx = 0;
  let busy = false;
  pair(0, 1);
  size();
  canvas.style.opacity = "1";

  const next = () => {
    if (busy || document.hidden) return;
    busy = true;
    const target = (idx + 1) % tex.length;
    pair(idx, target);
    gsap.fromTo(u.uProgress, { value: 0 }, {
      value: 1,
      duration: 2.4,
      ease: "power2.inOut",
      onUpdate: render,
      onComplete: () => {
        pair(target, target);
        u.uProgress.value = 0;
        idx = target;
        busy = false;
        render();
        onChange(target);
      },
    });
  };
  setInterval(next, 25_000);
  addEventListener("resize", size);
}
