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
  vec2 dir = normalize(a_target - a_source);
  vec2 arrowPos = a_target - dir * u_arrowSize;
  vec3 clip = u_matrix * vec3(arrowPos, 1.0);
  vec2 ndc = clip.xy / clip.z;
  v_arrowPixel = ((ndc * 0.5) + 0.5) * u_resolution;
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
  if(dist < u_arrowSize) {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    return;
  }
  gl_FragColor = v_color;
}
`;

// Build the full definition object.
const arrowEdgeDefinition = {
  VERTICES: 2,
  VERTEX_SHADER_SOURCE: vertexShader,
  FRAGMENT_SHADER_SOURCE: fragmentShader,
  UNIFORMS: [
    { name: 'u_matrix',     type: 'mat3',  default: new Float32Array([1,0,0,0,1,0,0,0,1]) },
    { name: 'u_arrowSize',   type: 'float', default: 8.0 },
    { name: 'u_resolution',  type: 'vec2',  default: new Float32Array([800,600]) }
  ],
  ATTRIBUTES: [
    { name: 'a_source', size: 2, type: 'float', default: new Float32Array([0,0]) },
    { name: 'a_target', size: 2, type: 'float', default: new Float32Array([0,0]) },
    { name: 'a_color',  size: 4, type: 'float', default: new Float32Array([1,1,1,1]) }
  ],
  CONSTANT_ATTRIBUTES: [],
  CONSTANT_DATA: [],
  METHOD: 'drawArrays',
  isInstanced: false
};

export default class ArrowEdgeProgram extends EdgeProgram {
  constructor(gl, renderer) {
    super(gl, renderer, arrowEdgeDefinition);  // pass definition directly
    this._definition = arrowEdgeDefinition;
    const { programInfo } = this;
    this.gl.uniform1f(
      programInfo.uniforms.u_arrowSize,
      arrowEdgeDefinition.UNIFORMS[1].default
    );
    this.gl.uniform2f(
      programInfo.uniforms.u_resolution,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );
  }

  process() {
    const { gl, programInfo } = this;
    gl.uniform2f(
      programInfo.uniforms.u_resolution,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );
  }

  // Define getDefinition on the class itself:
  getDefinition() {
    return this._definition;
  }
}

ArrowEdgeProgram.prototype.getDefinition = function () {
  return arrowEdgeDefinition;
};
