var spawn = require('child_process').spawn;
var path = require('path')
var fs = require('fs')
var prompt = require('prompt');

var INTERRUPT = false;

var config = {dir: 'D:\\', cameras: []}
var configPath = path.join('config.json')

function fileExists(loc) {
	try {var x = fs.statSync(loc); return x.isFile()}
	catch (err) {return false;}
}
function dirExists(loc) {
	try {var x = fs.statSync(loc); return x.isDirectory()}
	catch (err) {return false;}
}
function getDayDate() {
	var t = new Date();
	return [t.getFullYear(), ("0" + (t.getMonth() + 1)).slice(-2), ("0" + t.getDate()).slice(-2)].join('');
}
function getTime() {
	var t = new Date();
	return [("0" + (t.getHours())).slice(-2), ("0" + t.getMinutes()).slice(-2)].join('');
}

function secondsToNextHour() {
	var t = new Date();
	//return 60;
	return 3600 - t.getMinutes()*60 - t.getSeconds();
}

function milliSecondsToNextDay() {
  let now = new Date();
  // tomorrow date
  let tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
  return tomorrow - now; // difference in ms
}

function recordCam(c) {
	var iteration = 0;
	
	if (INTERRUPT)
		return;
		//return console.log('[*] Recording stopped for\x1b[36m Stream {{0}}\x1b[0m'.replace('{{0}}',c))
	
	//first verify the folder for the day exists
	var dayDir = path.join(config.dir,getDayDate());
	if (!dirExists(dayDir))
		fs.mkdirSync(dayDir)
	
	var filename = "Stream_"+c+'_%H-%M-%S.mp4';
	
	var link = config.cameras[c];
	
	var args = ['-i',link,'-c','copy','-f','segment','-strftime','1','-segment_time',config.minutes*60,'-segment_format_options','movflags=+faststart','-reset_timestamps','1',filename];
	
	var proc = spawn('ffmpeg',args, {cwd: dayDir});
	//console.log('[+] Started recording \x1b[36mStream {{0}}\x1b[0m to\x1b[31m {{1}}\x1b[0m'.replace('{{0}}',c).replace('{{1}}',filename));
	
	proc.stderr.on('data', (data) => {
        //console.log(data.toString())
		var regex = /Opening '([\w\-\.]+)' for writing/
		var match = regex.exec(data);
		if (match && match.length >=2){
			console.log('[+] Started recording of \x1b[36mStream {{0}}\x1b[0m to\x1b[31m {{1}}\x1b[0m (file {{2}})'.replace('{{0}}',c).replace('{{1}}',match[1]).replace('{{2}}',++iteration));
			if (iteration >= config.iterations  && config.iterations != 0){
				console.log('[+] All iterations completed for \x1b[36mStream {{0}}\x1b[0m'.replace('{{0}}',c))
				proc.kill();																											   
				return;
			}
		}
		});
	
	proc.on('exit', (code, signal) => {
		var msg = '[+] Recording\x1b[31m Stream_{{1}}\x1b[0m Closed.'.replace('{{1}}',c);
		if (code != 0)
			msg += " Error code:"+code;
		recordCam(c);
	})
	// proc.on('close', (code, signal) => {
		// var msg = '[+] Recording\x1b[31m Stream_{{1}}\x1b[0m Closed.'.replace('{{1}}',c);
		// if (code != 0)
			// msg += " Error code:"+code;
	// })
	
	var ms = milliSecondsToNextDay();
	setTimeout(()=>{proc.kill()},ms);
	//setTimeout(function(){recordCam(c)},secondsToNextHour()*1000);
	//setTimeout(function(){recordCam(c)},ms);
}

function startRecording() {
	//for each camera
	for (var c in config.cameras) {
		recordCam(c);
	}
}

function saveConfig() {
	fs.writeFile(configPath, JSON.stringify(config), function(err) {
		if (err)
			return console.error("[-] Error writing config to AppData:",err)
		console.log("[+] Successfully saved config to file")
	})
	return true;
}
function loadConfig(cb) {
	if (!fileExists(configPath))
		return cb(false);
	console.log("Found a config file at", configPath);
	console.log("Do you want to load it? (y/n) [y] ");
	rl.question("", (ans)=>{
		ans = ans.split(' ').join('');
		if (ans.toLowerCase() == 'y' || ans == "") {
			console.log("Loading..")
			try {_config = JSON.parse(fs.readFileSync(configPath, 'utf8')); config = _config; return cb(true)}
			catch (err) {console.log('[-] Failed parsing config file. Syntax might be incorrect'); return cb(false);}
		}
		return cb(false)
	})
	
}

function interactiveStart(skipConfig) {
	console.log("********************")
	console.log("** VM Cloud Stream Recorder")
	console.log("********************")
	// console.log("** ammar@vmclouds.co.uk")
	// console.log("********************")
	console.log("** To exit at any time, press Ctrl+C.")
	console.log("********************")
	
	if (skipConfig==true) {
		console.log(config);
		return startRecording();
	}
		

	// Choice 1
	// Ask for vlc location, recording location
	var schema = [
	// {
	// name: 'vlc',
    // description: 'Please enter the full path of the VLC directory, or press enter to try default. Tip: right click to paste',
    // type: 'string',
    // message: 'Couldn\'t auto determine location. Is VLC installed? Please enter path to directory containing vlc.exe', 
    // required: true,
	// default: findVLC(),
	// conform: checkVLCPath,
	// ask: ()=>{if (vlcConfigLoaded) {console.log('[+] FFMPEG installation found in path at',config.vlcPath,'\r\n'); return false}; return true;}
	// },
	{
	name: 'path',
    description: 'Enter recording path. Leave empty to default to D:\\ ',
    type: 'string',
    message: 'Check that this is a valid path with write permissions', 
    required: true,
	default: "D:\\",
	conform: function(value) {
		try {var x = fs.statSync(value); return x.isDirectory()}
		catch (err) {return false;}
		}
	},
	{
	name: 'ipList',
    description: 'Please enter the URLs of the streams to record, separated by commas (e.g. http://192.168.100.1/mpeg4,http://192.168.100.2/mpeg4 )',
    type: 'string',
    message: 'Please verify the URLs are valid', 
    required: true,
	conform: function(value) {
		//validate URLs
		return true;
	}},
	{
	name: 'minutes',
    description: 'Enter the desired length of each single recording, in minutes',
    type: 'integer',
    message: 'Check that this is a valid number', 
    required: true,
	default: "60",
	},
	{
	name: 'iterations',
    description: 'How many iterations of the recording do you want to do? Enter 0 to record until interrupted',
    type: 'integer',
    message: 'Check that this is a valid number', 
    required: true,
	default: "0",
	}]
	
	
	prompt.start();
	prompt.get(schema, function(err, results){
		if (err)
			return console.error(err)
		
		config.dir = results.path;
		config.vlcPath = results.vlc;
		config.minutes = results.minutes;
		config.iterations = results.iterations;
		var IPs = results.ipList.split(' ').join('').split(',');
		config.cameras = IPs;
		
		saveConfig();
		startRecording();
	})
	
}

function main() {
	//check if config file exists and try to load it
	loadConfig(interactiveStart);
}




function pauseConsole() {
	console.log('Press any key to exit..')
	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.on('data', process.exit.bind(process, 0));
}


var rl = require("readline").createInterface({
    input: process.stdin
  });
//Handle interrupts
if (process.platform === "win32") {
  

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

process.on("SIGINT", function () {
  if (INTERRUPT)
	   process.exit();
  console.log("[*] Interrupted. Current recording tasks will complete and then program will shut down.")
  console.log("[*] \x1b[31mPress Ctrl-C again to kill current recording tasks and exit immediately.\x1b[0m")
  INTERRUPT = true;
  //pauseConsole();
});

//interactiveStart()
main()
