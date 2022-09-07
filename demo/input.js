const keyCodes = {
	87: 'w',
	65: 'a',
	83: 's',
	68: 'd',
	69: 'e',
	81: 'q',
	37: 'left',
	38: 'up',
	39: 'right',
	40: 'down'
};

const keyStates = {
	w: false,
	a: false,
	s: false,
	d: false,
	q: false,
	e: false,
	left: false,
	up: false,
	right: false,
	down: false,
};


function onKeyboardEvent (event) {
	if (!keyCodes.hasOwnProperty(event.keyCode)) {
		return;
	}

	const keyName = keyCodes[event.keyCode];

	if (!keyStates.hasOwnProperty(keyName)) {
		return;
	}

	keyStates[keyName] = event.type === 'keydown';
}


function start () {
	document.addEventListener('keydown', onKeyboardEvent);
	document.addEventListener('keyup', onKeyboardEvent);
}


export {
	start,
	keyStates,
}