import { EdgeProgram } from 'sigma/rendering';

const vertexShader = `
precision highp float;

attribute vec2 a_source;
attribute vec2 a_target;
attribute vec4 a_color;

uniform mat3 u_matrix;
uniform float u_arrowSize;
uniform vec2 u_resolution;

varying vec4 v_color;
varying vec2 v_arrowPixel;

void main() {
  v_color = a_color;

  // Compute arrow center in graph space
  vec2 dir = normalize(a_target - a_source);
  vec2 arrowPos = a_target - dir * u_arrowSize;

  // Transform arrow center to clip space
  vec3 clip = u_matrix * vec3(arrowPos, 1.0);
  // Perspective divide → NDC
  vec2 ndc = clip.xy / clip.z;
  // Convert NDC ([-1,1]) → pixel coords
  v_arrowPixel = ((ndc * 0.5) + 0.5) * u_resolution;

  // Render the source endpoint for the edge line
  vec3 pos = u_matrix * vec3(a_source, 1.0);
  gl_Position = vec4(pos.xy / pos.z, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float u_arrowSize;

varying vec4 v_color;
varying vec2 v_arrowPixel;

void main() {
  vec2 frag = gl_FragCoord.xy;
  float dist = distance(frag, v_arrowPixel);

  // Debug: draw solid red circle for arrowhead
  if(dist < u_arrowSize) {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    return;
  }

  // Otherwise render the edge normally
  gl_FragColor = v_color;
}
`;

export default class ArrowEdgeProgram extends EdgeProgram {
  constructor(gl, renderer) {
    super(gl, renderer, { vertexShader, fragmentShader });
    // Initialize uniforms
    const { programInfo } = this;
    this.gl.uniform1f(programInfo.uniforms.u_arrowSize, 8.0);
    this.gl.uniform2f(
      programInfo.uniforms.u_resolution,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );
  }

  process() {
    const { gl, programInfo } = this;
    gl.uniform2f(programInfo.uniforms.u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }
}
