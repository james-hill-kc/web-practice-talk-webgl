/* Basic WebGL Demo
*******************/

// Canvas and context
const canvas = document.querySelector("#webgl-canvas");
const gl = canvas.getContext("webgl");

let projectionMatrix = null;
let modelViewMatrix = null;
let shaderProgram = null;


function initBuffers () {

	polygonBuffer = gl.createBuffer();

	const vertexArray = [
		0.0, 0.0, 0.0,
		1.0, 0.0, 0.0,
		1.0, 1.0, 0.0,
		1.0, 1.0, 0.0,
		0.0, 1.0, 0.0,
		0.0, 0.0, 0.0
	];
	
	gl.bindBuffer(gl.ARRAY_BUFFER, polygonBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

	polygonTextureBuffer = gl.createBuffer();

	var textureCoordArray = [
		0.0, 0.0,
		1.0, 0.0,
		1.0, 1.0,
		1.0, 1.0,
		0.0, 1.0,
		0.0, 0.0
	];

	gl.bindBuffer(gl.ARRAY_BUFFER, polygonTextureBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordArray), gl.STATIC_DRAW);
}


function initShaders () {

	// Source code for shaders
	const vertexShaderSrc = `
		uniform mat4 uProjectionMatrix;
		uniform mat4 uModelViewMatrix;
		attribute vec3 aVertex;
		attribute vec2 aTextureCoord;
		varying highp vec2 vTextureCoord;

		void main(void) {
			vTextureCoord = aTextureCoord;
			gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertex, 1.0);
		};
	`;

	const fragmentShaderSrc = `
		precision highp float;
		uniform sampler2D uSampler;
		varying highp vec2 vTextureCoord;

		void main(void){
			vec3 textureColour = texture2D(uSampler, vTextureCoord.st).rgb;
			gl_FragColor = vec4(textureColour, 1.0);
		};
	`;

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
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) || !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.warn('Shader compilation failed');
		return false;
	}

	// Attach the vertex and fragment shaders to the shader program
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);

	// Link the shader program
	gl.linkProgram(shaderProgram);

	// Tell WebGL to use the shader program
	gl.useProgram(shaderProgram);

	// ..
	const shaderAttributes = [];
	const shaderUniforms = [];

	shaderAttributes["aVertex"] = gl.getAttribLocation(shaderProgram, "aVertex");
	gl.enableVertexAttribArray(shaderAttributes["aVertex"]);

	shaderAttributes["aTextureCoord"] = gl.getAttribLocation(shaderProgram, "aTextureCoord");
	gl.enableVertexAttribArray(shaderAttributes["aTextureCoord"]);

	shaderUniforms["uProjectionMatrix"] = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
	shaderUniforms["uModelViewMatrix"] = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");

	return true;
}


function initTextures () {

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


function draw () {

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear the canvas

	gl.bindBuffer(gl.ARRAY_BUFFER, polygonBuffer);
	gl.vertexAttribPointer(shader["aVertex"], 3, gl.FLOAT, false, 0, 0);

	gl.uniformMatrix4fv(shaderUniforms["uProjectionMatrix"], false, new Float32Array(projectionMatrix));
	gl.uniformMatrix4fv(shaderUniforms["uModelViewMatrix"], false, new Float32Array(modelViewMatrix));

	if(textureLoaded){

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(shaderUniforms["uSampler"], 0);
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, polygonTextureBuffer);
	gl.vertexAttribPointer(shaderAttributes["aTextureCoord"], 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.TRIANGLES, 0, 6);

	mat4.rotateY(modelViewMatrix, modelViewMatrix, 0.05); // Rotate the model view matrix by a small amount each frame to make the model spin
}


function renderingLoop () {

	draw();
	
	// Next loop
	window.requestAnimationFrame(renderingLoop);
}


function init () {

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

	// Set up projection matrix using glmatrix library (trust me, you don't want to write your own version of this...)
	projectionMatrix = mat4.create();

	const verticalFieldOfViewAngleInRadians = 45 * Math.PI / 180; // radians
	const viewportAspectRatio = canvas.width / canvas.height;
	const nearClippingBound = 1.0; // near bound of the view frustum (anything closer to the camera viewpoint will be clipped, i.e. not drawn)
	const farClippingBound = 1000.0; // far bound of the view frustum (anything further from the camera viewpoint will be clipped)

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
	initBuffers();
	if (!initShaders()) {
		console.warn('initShaders failed');
		return;
	}
	if (!initTextures()) {
		console.warn('initTextures failed');
		return;
	}

	// Start render loop
	window.requestAnimationFrame(renderingLoop);
}


window.onload = init;
