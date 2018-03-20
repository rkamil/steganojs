var fileInput = document.getElementById('fileInput'),
	bitsInput = document.getElementById('bitsInput'),
	bitmapInput = document.getElementById('bitmapInput'),
	readInput = document.getElementById('readInput'),
	beforeImg = document.getElementById('beforeImg'),
	afterImg = document.getElementById('afterImg'),
	fileData = null;

// wybranie pliku do ukrycia
fileInput.onchange = function (e) {
	if (this.files.length == 0)
		return;
		
	fileInput.disabled = true;
		
	var file = this.files[0],
		reader = new FileReader();
		
	reader.onload = function (e) {
		var arrayBuffer = e.target.result,
			bytes = new Uint8Array(arrayBuffer);
			
		fileData = bytes;
	};
	
	reader.readAsArrayBuffer(file);
};

// wybranie ilości bitów
bitsInput.onchange = function (e) {
	bitsInput.disabled = true;
}

// wybranie bitmapy
bitmapInput.onchange = function (e) {
	if (this.files.length == 0)
		return;
		
	bitmapInput.disabled = true;
		
	var file = this.files[0],
		reader = new FileReader();
		
	reader.onload = function (e) {
		var arrayBuffer = e.target.result,
			bytes = new Uint8Array(arrayBuffer);
			
		parseBitmapBytes(bytes);
	};
	
	reader.readAsArrayBuffer(file);
};

// wybranie pliku do odkrycia
readInput.onchange = function (e) {
	if (this.files.length == 0)
		return;
		
	var file = this.files[0],
		reader = new FileReader();
		
	reader.onload = function (e) {
		var arrayBuffer = e.target.result,
			bytes = new Uint8Array(arrayBuffer);
			
		readSecretFromBitmap(bytes);
	};
	
	reader.readAsArrayBuffer(file);
};


// parsowanie bajtów bitmapy
function parseBitmapBytes(bytes) {
	
	document.getElementById('write-links').innerHTML = '';
	beforeImg.src = '';
	afterImg.src = '';
	
	// little-endian - należy pamiętać o kolejności bajtów
	
	// dane dotyczące nagłówka
	// width  - 18,19,20,21
	// height - 22,23,24,25
	// własne pola: 6,7,8,9, 38
	// 				38 - ilość zapisanych danych
	//               6 - ilość bitów na składową
	
	// wymiary bitmapy
	var width = 0 | 0,
		height = 0 | 0;
		
	// szerokość	
	width = bytes[21];
	width <<=8;
	width |= bytes[20];
	width <<=8;
	width |= bytes[19];
	width <<=8;
	width |= bytes[18];
	
	// wysokość
	height = bytes[25];
	height <<=8;
	height |= bytes[24];
	height <<=8;
	height |= bytes[23];
	height <<=8;
	height |= bytes[22];
	
	// ilość składowych pixeli
	var size = 3 * width * height;
	
	// offset od którego zaczynają się dane pixeli
	var offset = bytes[10];
	
	// sprawdzenie, czy dane zmieszczą się w bitmapie
	var bitmapCapacity = Math.floor(size * bitsInput.value / 8),
		secretSize = fileInput.files[0].size;
		
	if (bitmapCapacity < secretSize)
		return alert('Te dane się nie zmieszczą! Pojemność bitmapy: ' + bitmapCapacity + ' bajtów, wielkość sekretu: ' + secretSize + ' bajtów');
	
	// wyświetlenie podglądu przed
	displayPreview(bytes, beforeImg);
	
	// ukrycie danych w bitmapie
	hideSecretInBitmap(bytes);
	
	// zapisanie nagłówka 
	writeHeader(bytes);
	
	// wyświetle podglądu po
	displayPreview(bytes, afterImg);
	
	// utworzenie binarnego pliku
	var blob = new Blob([bytes], {type: 'image/bmp'});
	
	// utworzenie linku pobrania
	var ahref = document.createElement('a');
	
	ahref.href = URL.createObjectURL(blob);
	ahref.download = 'bitmap.bmp';
	ahref.innerText = 'pobierz bitmapę';
	
	document.getElementById('write-links').appendChild(ahref);
}

// ukrycie sekretu w bitmapie
function hideSecretInBitmap(bytes) {
	
	var perColor = bitsInput.value,
		perByte = 8 / perColor,
		fileSize = fileInput.files[0].size,
		offset = 54;
		
	// iterowanie po składowych bitmapy
	for (var i = 0; i < fileSize * perByte; i++) {
		
		var mask = (255 << perColor) & 255,
			byteNumber = Math.floor(i / perByte),
			pos = i - byteNumber * perByte,
			tmp = fileData[byteNumber] & 255,
		
		tmp = tmp << (pos * perColor);
		tmp = tmp & 255;
		tmp = tmp >> (8 - perColor);
		
		bytes[i+offset] = (bytes[i+offset] & mask) | tmp;
	}
	
}

// odczytanie sekretu bitmapy
function readSecretFromBitmap(bytes) {
	document.getElementById('read-links').innerHTML = '';
	
	if (!validateHeader(bytes))
		return alert('Ten plik nie zawiera sekretu!');
		
	var header = readHeader(bytes);
	
	var perColor = header.bits,
		perByte = 8 / perColor,
		fileSize = header.fileSize,
		fileData = new Uint8Array(fileSize),
		offset = 54;
		
	// iterowanie po składowych bitmapy
	for (var i = 0; i < fileSize * perByte; i++) {
		
		var mask = (Math.pow(2, perColor) - 1) & 255,
			byteNumber = Math.floor(i / perByte),
			tmp = bytes[i+offset],
			val = tmp & mask;
		
		fileData[byteNumber] <<= perColor;
		fileData[byteNumber] |= val;
	}
		
	// utworzenie binarnego pliku
	var blob = new Blob([fileData], {type: 'application/octet-stream'});
	
	// utworzenie linku do pobrania
	var ahref = document.createElement('a');
	
	ahref.href = URL.createObjectURL(blob);
	ahref.download = 'sekret.bin';
	ahref.innerText = 'pobierz sekret';
	
	document.getElementById('read-links').appendChild(ahref);
}


// zapisanie danych nagłówka do bitmapy
function writeHeader(bytes) {
	var fileSize = fileInput.files[0].size | 0,
		bits = bitsInput.value | 0;
		
		
	// zapisanie ilości danych - bajty 38-41
	var a = fileSize >> 24,
		b = (fileSize >> 16) & 255,
		c = (fileSize >> 8) & 255,
		d = fileSize & 255;
		
	// litle-endian
	bytes[38] = d;
	bytes[39] = c;
	bytes[40] = b;
	bytes[41] = a;
	
	// zapisanie ilości bitów na składową - bajt 6
	bytes[6] = bits;
}

// odczyt nagłówka
function readHeader(bytes) {
	
	// ilość zapisanych danych - bajty 38-41
	var fileSize = 0 | 0;
	
	fileSize = bytes[41];
	fileSize <<= 8;
	fileSize |= bytes[40];
	fileSize <<= 8;
	fileSize |= bytes[39];
	fileSize <<= 8;
	fileSize |= bytes[38];
	
	// ilość bitów na składową - bajt 6
	var bits = bytes[6];
	
	return {
		fileSize: fileSize,
		bits: bits
	};
}

// walidacja nagłówka
function validateHeader(bytes) {
	var data = readHeader(bytes);
	
	if (data.fileSize == 0)
		return false;
		
	if (data.bits > 8 || data.bits < 1)
		return false;
		
	return true;
}

// wyświetlenie podglądu
function displayPreview(bytes, el) {
	
	var blob = new Blob([bytes], {type: 'image/bmp'}),
		reader = new FileReader();
		
	reader.onload = function (e) {
		el.src = reader.result;
	};
	
	reader.readAsDataURL(blob);
}

