/* Basic WebGL Demo
*******************/

// Source code for shaders
// Vertex shaders run an iteration for each vertex
const vertexShaderSrc = `
	uniform mat4 uProjectionMatrix;
	uniform mat4 uModelViewMatrix;
	attribute vec3 aVertex;
	attribute vec2 aTextureCoord;
	varying highp vec2 vTextureCoord;

	void main(void) {
		vTextureCoord = aTextureCoord;
		gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertex, 1.0);
	}
`;

// Fragment shaders run an iteration for each pixel
const fragmentShaderSrc = `
	precision highp float;
	uniform sampler2D uSampler;
	varying highp vec2 vTextureCoord;

	void main(void){
		vec3 textureColour = texture2D(uSampler, vTextureCoord.st).rgb;
		gl_FragColor = vec4(textureColour, 1.0);
	}
`;

// Canvas and context
const canvas = document.querySelector("#webgl-canvas");
const gl = canvas.getContext("webgl");

// We will use these to feed data to the shader program running on the GPU (vertices, textures and so on)
const shaderAttributes = {}; // attributes are shader params which vary for each iteration of the shader (eg. vertices)
const shaderUniforms = {}; // uniforms are shader params which are constant for all iterations of the shader

// Matrices used for model, view and projection transforms
let modelViewMatrix = null;
let projectionMatrix = null;

let shaderProgram = null; // Reference to the shader program
let texture = null;
let textureLoaded = false;

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

// WebGL winding order is clockwise (triangles drawn in clockwise direction are considered front-facing)
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


function setupBuffers () {

	polygonBuffer = gl.createBuffer();

	gl.bindBuffer(gl.ARRAY_BUFFER, polygonBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

	polygonTextureBuffer = gl.createBuffer();

	gl.bindBuffer(gl.ARRAY_BUFFER, polygonTextureBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
}


function setupShaders () {

	// Create an empty shader program
	shaderProgram = gl.createProgram();

	// Create empty vertex and fragment shaders
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

	// Compile the shader source into shader programs to run on the GPU
	gl.shaderSource(vertexShader, vertexShaderSrc);
	gl.compileShader(vertexShader);
	gl.shaderSource(fragmentShader, fragmentShaderSrc);
	gl.compileShader(fragmentShader);

	// Check if compilation succeeded
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.warn('vertex shader compilation failed');
		console.log(gl.getShaderInfoLog(vertexShader));
		return false;
	}
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.warn('fragment shader compilation failed');
		console.log(gl.getShaderInfoLog(fragmentShader));
		return false;
	}

	// Attach the vertex and fragment shaders to the shader program
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);

	// Link the shader program
	gl.linkProgram(shaderProgram);

	// Tell WebGL to use the shader program
	gl.useProgram(shaderProgram);

	// Set up inputs needed to feed data to the shader program
	// Vertices and texture coordinates vary with each shader iteration, so are declared as attributes
	shaderAttributes["aVertex"] = gl.getAttribLocation(shaderProgram, "aVertex"); // we must request the location of the attribute input from the shader program
	gl.enableVertexAttribArray(shaderAttributes["aVertex"]); // then the input must be enabled

	shaderAttributes["aTextureCoord"] = gl.getAttribLocation(shaderProgram, "aTextureCoord");
	gl.enableVertexAttribArray(shaderAttributes["aTextureCoord"]);

	// the viewModel and projection matrices are the same for all shader iterations, so are declared as uniforms
	shaderUniforms["uProjectionMatrix"] = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
	shaderUniforms["uModelViewMatrix"] = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");

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
		gl.bindTexture(gl.TEXTURE_2D, null);

		textureLoaded = true;
	};

	img.src = "./test1.png";

	return true;
}


function update () {
	// Rotate the model
	mat4.rotateX(modelViewMatrix, modelViewMatrix, 0.001);
	mat4.rotateY(modelViewMatrix, modelViewMatrix, 0.001);
	mat4.rotateZ(modelViewMatrix, modelViewMatrix, 0.001);

	// Translate the model
	// let transformationVector = vec3.create();
	// vec3.set(transformationVector, 0, 0, -0.01);
	// mat4.translate(modelViewMatrix, modelViewMatrix, transformationVector);
}


function draw () {

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear the canvas

	gl.bindBuffer(gl.ARRAY_BUFFER, polygonBuffer);
	gl.vertexAttribPointer(shaderAttributes["aVertex"], 3, gl.FLOAT, false, 0, 0);

	gl.uniformMatrix4fv(shaderUniforms["uProjectionMatrix"], false, new Float32Array(projectionMatrix));
	gl.uniformMatrix4fv(shaderUniforms["uModelViewMatrix"], false, new Float32Array(modelViewMatrix));

	if (textureLoaded) {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(shaderUniforms["uSampler"], 0);
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, polygonTextureBuffer);
	gl.vertexAttribPointer(shaderAttributes["aTextureCoord"], 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.TRIANGLES, 0, 36);
}


function renderingLoop () {

	update();
	draw();
	
	// Next loop
	window.requestAnimationFrame(renderingLoop);
}


function start () {

	// Check for WebGL support
	if (gl === null) {
		console.warn('Unable to initialize WebGL. Your browser or machine may not support it.');
		return;
	}

	// Set the color which will be used to clear the canvas before each render
	gl.clearColor(0, 0, 0, 1);

	// Set up depth buffer
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);

	// Set up projection matrix using glmatrix library
	projectionMatrix = mat4.create();

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

	// Set up a model view matrix
	// this encodes the result of the model and view transforms
	// the model transform transforms the object relative to the world (position, rotation, scale)
	// the view transform orients the object it relative to the camera viewpoint
	// finally, the perspective transform projects the result of the previous transforms into screen space to give 2D rendering coordinates
	modelViewMatrix = mat4.create();
	let moveVector = vec3.create();

	// Translate the model view matrix 5 units in negative Z axis ("into" the screen)
	vec3.set(moveVector, 0, 0, -5.0);
	mat4.translate(modelViewMatrix, mat4.create(), moveVector);

	// Initialise buffers, shaders, and textures
	setupBuffers();

	if (!setupShaders()) {
		console.warn('setupShaders failed');
		return;
	}
	if (!setupTextures()) {
		console.warn('setupTextures failed');
		return;
	}

	// Start render loop
	window.requestAnimationFrame(renderingLoop);
}


window.onload = start;
