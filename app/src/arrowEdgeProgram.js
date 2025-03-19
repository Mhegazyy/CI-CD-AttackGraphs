import { EdgeProgram } from 'sigma/rendering';

// Updated Vertex Shader: Compute an arrow center (in graph space) and pass it as a varying.
const vertexShader = `
precision mediump float;

attribute vec2 a_source;
attribute vec2 a_target;
attribute float a_size;
attribute vec4 a_color;

uniform mat3 u_matrix;
uniform float u_arrowSize;

varying vec4 v_color;
varying vec2 v_arrowCenter;

void main() {
  v_color = a_color;
  
  // Compute the direction from source to target.
  vec2 diff = a_target - a_source;
  vec2 dir = normalize(diff);
  
  // Compute an "arrow center" at a distance u_arrowSize from the target, along the edge.
  v_arrowCenter = a_target - dir * u_arrowSize;
  
  // Project the source position.
  vec3 pos = u_matrix * vec3(a_source, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
}
`;

// Updated Fragment Shader: For debugging, output solid red if the fragment is near the arrow center.
const fragmentShader = `
precision mediump float;

uniform float u_arrowSize;

varying vec4 v_color;
varying vec2 v_arrowCenter;

void main() {
  // For debugging, we assume that gl_FragCoord.xy is roughly in the same space as v_arrowCenter.
  // (In production, you'd need a proper conversion.)
  float d = distance(gl_FragCoord.xy, v_arrowCenter);
  
  if(d < u_arrowSize) {
    // Output red to indicate the arrow region.
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = v_color;
  }
}
`;

class ArrowEdgeProgram extends EdgeProgram {
  constructor(gl, renderer) {
    super(gl, renderer, {
      vertexShader,
      fragmentShader,
    });
    // Set the uniform for arrow size.
    this.gl.uniform1f(this.programInfo.uniforms.u_arrowSize, 8.0);
  }
}

export default ArrowEdgeProgram;
