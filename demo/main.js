/* Basic WebGL Demo
*******************/

import { start as startInput, keyStates } from './input.js';

// Source code for shaders
// To enable GLSL 300 es, the first line of each MUST be "#version 300 es" - no characters before it, including newlines, spaces etc.

// Vertex shader runs one iteration for each vertex
// It generates pixel coordinates using the input data, and outputs them for use by the fragment shader
const vertexShaderSource = `#version 300 es

	uniform mat4 u_projection_matrix;
	uniform mat4 u_model_view_matrix;
	in vec3 a_vertex_position;
	in vec2 a_texture_coord;
	out vec2 v_texture_coord;

	void main(void) {
		v_texture_coord = a_texture_coord;
		gl_Position = u_projection_matrix * u_model_view_matrix * vec4(a_vertex_position, 1.0);
	}
`;

// Fragment shader runs one iteration for each pixel
// Output is the final colour of the pixel to be rendered on the screen
const fragmentShaderSource = `#version 300 es

	precision highp float;

	uniform sampler2D u_sampler;
	in vec2 v_texture_coord;
	out vec4 fragmentColor;

	void main(void){
		vec3 texture_color = texture(u_sampler, v_texture_coord.st).rgb;
		fragmentColor = vec4(texture_color, 1.0);
	}
`;

const canvas = document.querySelector("#webgl-canvas");
const gl = canvas.getContext("webgl2");

const shaderAttributes = {}; // attributes are shader params which vary for each iteration of the shader (eg. vertices)
const shaderUniforms = {}; // uniforms are shader params which are constant for all iterations of the shader

let rotationMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let projectionMatrix = mat4.create();

let shaderProgram = null; // Reference to the shader program

let vertexBuffer = null;
let textureBuffer = null;

let texture = null;
let textureLoaded = false; // We don't want to use the texture until it's loaded

const cubeVertices = [
	[ -1,  1,  1 ], // left, top, front
	[  1,  1,  1 ], // right, top, front
	[  1, -1,  1 ], // right, bottom, front
	[ -1, -1,  1 ], // left, bottom, front 
	[ -1,  1, -1 ], // left, top, back
	[  1,  1, -1 ], // right, top, back
	[  1, -1, -1 ], // right, bottom, back
	[ -1, -1, -1 ], // left, bottom, back 
];

// This is inefficient, but easier to visualise
const cubeTriangles = {
	frontFace: {
		a: [cubeVertices[0], cubeVertices[1], cubeVertices[2]],
		b: [cubeVertices[0], cubeVertices[2], cubeVertices[3]]
	},
	topFace: {
		a: [cubeVertices[4], cubeVertices[5], cubeVertices[1]],
		b: [cubeVertices[4], cubeVertices[1], cubeVertices[0]]
	},
	rightFace: {
		a: [cubeVertices[1], cubeVertices[5], cubeVertices[6]],
		b: [cubeVertices[1], cubeVertices[6], cubeVertices[2]]
	},
	bottomFace: {
		a: [cubeVertices[3], cubeVertices[2], cubeVertices[6]],
		b: [cubeVertices[3], cubeVertices[6], cubeVertices[7]]
	},
	leftFace: {
		a: [cubeVertices[4], cubeVertices[0], cubeVertices[3]],
		b: [cubeVertices[4], cubeVertices[3], cubeVertices[7]]
	},
	backFace: {
		a: [cubeVertices[5], cubeVertices[4], cubeVertices[7]],
		b: [cubeVertices[5], cubeVertices[7], cubeVertices[6]]
	}
};

const cubeFaceTextureCoordinates = {
	a: [
		0, 0, 
		1, 0,
		1, 1
	],
	b: [
		0, 0, 
		1, 1,
		0, 1
	]
};

const vertices = [
	cubeTriangles.frontFace.a[0], 	cubeTriangles.frontFace.a[1], 	cubeTriangles.frontFace.a[2],
	cubeTriangles.frontFace.b[0], 	cubeTriangles.frontFace.b[1], 	cubeTriangles.frontFace.b[2],
	cubeTriangles.topFace.a[0], 	cubeTriangles.topFace.a[1], 	cubeTriangles.topFace.a[2],
	cubeTriangles.topFace.b[0], 	cubeTriangles.topFace.b[1], 	cubeTriangles.topFace.b[2],
	cubeTriangles.rightFace.a[0], 	cubeTriangles.rightFace.a[1], 	cubeTriangles.rightFace.a[2],
	cubeTriangles.rightFace.b[0], 	cubeTriangles.rightFace.b[1], 	cubeTriangles.rightFace.b[2],
	cubeTriangles.bottomFace.a[0], 	cubeTriangles.bottomFace.a[1], 	cubeTriangles.bottomFace.a[2],
	cubeTriangles.bottomFace.b[0], 	cubeTriangles.bottomFace.b[1], 	cubeTriangles.bottomFace.b[2],
	cubeTriangles.leftFace.a[0], 	cubeTriangles.leftFace.a[1], 	cubeTriangles.leftFace.a[2],
	cubeTriangles.leftFace.b[0], 	cubeTriangles.leftFace.b[1], 	cubeTriangles.leftFace.b[2],
	cubeTriangles.backFace.a[0], 	cubeTriangles.backFace.a[1], 	cubeTriangles.backFace.a[2],
	cubeTriangles.backFace.b[0], 	cubeTriangles.backFace.b[1], 	cubeTriangles.backFace.b[2]
].flat();

const textureCoordinates = [
	cubeFaceTextureCoordinates.a,
	cubeFaceTextureCoordinates.b,
	cubeFaceTextureCoordinates.a,
	cubeFaceTextureCoordinates.b,
	cubeFaceTextureCoordinates.a,
	cubeFaceTextureCoordinates.b,
	cubeFaceTextureCoordinates.a,
	cubeFaceTextureCoordinates.b,
	cubeFaceTextureCoordinates.a,
	cubeFaceTextureCoordinates.b,
	cubeFaceTextureCoordinates.a,
	cubeFaceTextureCoordinates.b
].flat();

const modelPosition = {
	x: 0,
	y: 0,
	z: -5 // start position is 5 units "into" the screen
};


function setupBuffer (sourceData) {
	const buffer = gl.createBuffer();

	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sourceData), gl.STATIC_DRAW);

	return buffer;
}


function setupBuffers () {
	vertexBuffer = setupBuffer(vertices);
	textureBuffer = setupBuffer(textureCoordinates);
}


function createShader (gl, type, source) {
	let shader = gl.createShader(type);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.warn(`${type} shader compilation failed:`);
		console.log(gl.getShaderInfoLog(shader));
		return false;
	}

	return shader;
}


function setupShaders () {
	shaderProgram = gl.createProgram();

	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	
	gl.linkProgram(shaderProgram);
	
	gl.useProgram(shaderProgram);

	// Set up inputs needed to feed data to the shader program
	shaderAttributes["a_vertex_position"] = gl.getAttribLocation(shaderProgram, "a_vertex_position"); // we must request the location of the attribute input from the shader program
	gl.enableVertexAttribArray(shaderAttributes["a_vertex_position"]); // then the input must be enabled

	shaderAttributes["a_texture_coord"] = gl.getAttribLocation(shaderProgram, "a_texture_coord");
	gl.enableVertexAttribArray(shaderAttributes["a_texture_coord"]);

	shaderUniforms["u_projection_matrix"] = gl.getUniformLocation(shaderProgram, "u_projection_matrix");
	shaderUniforms["u_model_view_matrix"] = gl.getUniformLocation(shaderProgram, "u_model_view_matrix");

	return true;
}


function setupTextures () {
	texture = gl.createTexture();

	var img = new Image();

	img.onload = function(){

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		textureLoaded = true;
	};

	img.src = "./crate.png";

	return true;
}


function updateModelPosition () {
	const speed = 0.05;

	if (keyStates.left) {
		modelPosition.x -= speed;
	}
	else if (keyStates.right) {
		modelPosition.x += speed;
	}

	if (keyStates.up) {
		modelPosition.z -= speed;
	}
	else if (keyStates.down) {
		modelPosition.z += speed;
	}
}


function updateModelRotation () {
	const speed = 0.01;

	if (keyStates.w) {
		mat4.rotateX(rotationMatrix, rotationMatrix, speed);
	}
	else if (keyStates.s) {
		mat4.rotateX(rotationMatrix, rotationMatrix, -speed);
	}

	if (keyStates.a) {
		mat4.rotateY(rotationMatrix, rotationMatrix, speed);
	}
	else if (keyStates.d) {
		mat4.rotateY(rotationMatrix, rotationMatrix, -speed);
	}

	if (keyStates.q) {
		mat4.rotateZ(rotationMatrix, rotationMatrix, speed);
	}
	else if (keyStates.e) {
		mat4.rotateZ(rotationMatrix, rotationMatrix, -speed);
	}
}


function updateModelViewMatrix () {
	modelViewMatrix = mat4.identity(modelViewMatrix);

	// Position must be tracked separately. If we just continually reuse modelViewMatrix, it will accumulate values,
	// which has the effect of translating (moving) the object relative to its rotation, which is usually not desirable
	let positionVector = vec3.create();
	vec3.set(positionVector, modelPosition.x, modelPosition.y, modelPosition.z);

	modelViewMatrix = mat4.translate(modelViewMatrix, mat4.create(), positionVector);
	modelViewMatrix = mat4.multiply(modelViewMatrix, modelViewMatrix, rotationMatrix);
}


function update () {
	updateModelPosition();
	updateModelRotation();
	updateModelViewMatrix();
}


function draw () {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear the canvas

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.vertexAttribPointer(shaderAttributes["a_vertex_position"], 3, gl.FLOAT, false, 0, 0);

	gl.uniformMatrix4fv(shaderUniforms["u_projection_matrix"], false, new Float32Array(projectionMatrix));
	gl.uniformMatrix4fv(shaderUniforms["u_model_view_matrix"], false, new Float32Array(modelViewMatrix));

	if (textureLoaded) {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(shaderUniforms["u_sampler"], 0);
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
	gl.vertexAttribPointer(shaderAttributes["a_texture_coord"], 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.TRIANGLES, 0, 36);
}


function renderingLoop () {
	update();
	draw();
	
	window.requestAnimationFrame(renderingLoop);
}


function start () {
	if (!gl) {
		console.warn('WebGL 2 not supported.');
		return;
	}

	gl.clearColor(0, 0, 0, 1); // Set the color which will be used to clear the canvas before each render

	gl.enable(gl.DEPTH_TEST); // Set up depth buffer
	gl.depthFunc(gl.LEQUAL);

	const verticalFieldOfViewAngleInRadians = 45 * Math.PI / 180; // radians
	const viewportAspectRatio = canvas.width / canvas.height;
	const nearClippingBound = 1.0; // near bound of the view frustum (anything closer to the camera viewpoint will be clipped, i.e. not drawn)
	const farClippingBound = 25.0; // far bound of the view frustum (anything further from the camera viewpoint will be clipped)

	mat4.perspective(
		projectionMatrix,
		verticalFieldOfViewAngleInRadians,
		viewportAspectRatio,
		nearClippingBound,
		farClippingBound
	);

	setupBuffers();

	if (!setupShaders()) {
		console.warn('setupShaders failed');
		return;
	}
	if (!setupTextures()) {
		console.warn('setupTextures failed');
		return;
	}

	startInput();

	window.requestAnimationFrame(renderingLoop); // Start render loop
}


window.onload = start;
