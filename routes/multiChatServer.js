var linebot = require('linebot');
var wechat = require('wechat');
var express = require('express');
var apiai = require('apiai');
var bodyParser = require('body-parser');
const request = require('request');
var querystring = require('querystring');

//var TokenManager = require('wechat-token');
const { WechatClient } = require('messaging-api-wechat');
const { LineClient } = require('messaging-api-line');
const ngrok = require('ngrok');
const https = require('https');

// Load from config.json

const configPath = global.mulChatConfigPath;
//const configPath = "../config";
const config = require(configPath);
//const config = require('../config');
const serverConfig = config.server;
const lineConfig = config.line;
const wechatConfig = config.wechat;
const messengerConfig = config.messenger;
const dialogflowConfig = config.dialogflow;
const googleTranslateConfig = config.googleTranslate;
const twilioConfig = config.twilio;
const ngrokConfig = config.ngrok;
var ngrokURL = "";
var operatorHasLogin =  false;
var userData;

var socketOperator;
var currentActiveOperatorUser;

const twilioClient = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const uuidv1 = require('uuid/v1');

var ChatUser = function(package, socket, sender, state, operatorRequest, pendingMessage){
  this.package = package,
  this.socket = socket,
  this.sender = sender,
  this.state = state,
  this.operatorRequest = operatorRequest,
  this.pendingMessage = pendingMessage
}

var WaitingUser = function(package, sender){
  this.package = package,
  this.sender = sender
}

var weChatUserInfo = function(nickname, sex, language, city, province, country){
  this.nickname = nickname,
  this.sex = sex,
  this.language = language,
  this.city = city,
  this.province = province,
  this.country = country
}

var incomingChatUser = [];
var weChatUserOpenId = [];
var wechatUserDetail = [];

var lineBot = linebot({
  channelId: lineConfig.channelID,
  channelSecret: lineConfig.channelSecret,
  channelAccessToken: lineConfig.channelAccessToken
});

const lineClient = LineClient.connect({
  accessToken: lineConfig.channelAccessToken,
  channelSecret: lineConfig.channelSecret
});


var wechatConfigurations = {
  token : wechatConfig.token,
  appid : wechatConfig.appID,
  appsecret : wechatConfig.appSecret,
  encodingAESKey : ''
};

const wechatClient = WechatClient.connect({
  appId: wechatConfig.appID,
  appSecret: wechatConfig.appSecret,
});


//var tokenManager = new TokenManager(wechatConfig.appID, wechatConfig.appSecret);
//var accessToken = '';

var jsonParser = bodyParser.json();

var urlencodedParser = bodyParser.urlencoded({ extended: false })

// Imports the Google Cloud client library
const Translate = require('@google-cloud/translate');

// Instantiates a client
const translate = new Translate({
  projectId: googleTranslateConfig.projectId,
});





function detectLanguage(text, callback) {

  // Detects the language. "text" can be a string for detecting the language of
  // a single piece of text, or an array of strings for detecting the languages
  // of multiple texts.
  translate.detect(text)
    .then(results => {
      //console.log(results);
      let detections = results[0];
      detections = Array.isArray(detections) ? detections : [detections];

      //console.log('Detections:');
      detections.forEach(detection => {
        //console.log(`${detection.input} => ${detection.language}`);
        //console.log(detection.language);
        callback(detection.language);
      });
    })
    .catch(err => {
      console.error('ERROR:', err);
      callback("error");
    });

}


async function connectNgrok() {
  try {
    const url = await ngrok.connect({
      proto: 'http', // http|tcp|tls, defaults to http
      addr: serverConfig.serverPort, // port or network address, defaultst to 80
      authtoken: ngrokConfig.ngrokToken, // your authtoken from ngrok.com
    });
    if ((url.indexOf(".ngrok.io") > -1)&&(url.indexOf("https://") > -1)){
      ngrokURL = url;
      console.log("wechat webhook: " + url + "/wechatwebhook");
      console.log("messenger webhook: " + url + "/messengerwebhook");
      console.log("line webhook: " + url + "/linewebhook");
    }


  }
  catch (err) {
    console.log('ngrok failed', err);
  }
}

function initSocketIo(){
    if (serverConfig.socketIoURL.indexOf("https") > -1){
      socket = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { secure: true, reconnect: true, rejectUnauthorized : false });
      socketOperator = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { secure: true, reconnect: true, rejectUnauthorized : false });
    
    } else {
      socket = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { forceNew: true });
      socketOperator = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { forceNew: true });

    }
}

function setupOperatorChannel(){
  if (serverConfig.socketIoURL.indexOf("https") > -1){
    socketOperator = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { secure: true, reconnect: true, rejectUnauthorized : false });
    
  } else {
    socketOperator = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { forceNew: true });

  }

  socketOperator.emit("user", "operatorSessionUserNonAndroid");

    socketOperator.on('operatorConnectNonAndroid', function(data){
      console.log(socketOperator.id + ": " + 'operatorConnectNonAndroid');
      if (data === "disconnect"){
        currentActiveOperatorUser = "";
        console.log("currentActiveOperatorUser: " + currentActiveOperatorUser);
        socketOperator.emit("deleteContactOperatorSessionNonAndroid", data);
      } else {
        currentActiveOperatorUser = data;
        console.log("currentActiveOperatorUser: " + currentActiveOperatorUser);
        socketOperator.emit("addContactOperatorSessionNonAndroid", data);
      }
    });

    
        // admin send message to user
    socketOperator.on('operatorToUserNonAndroid', function(data){
      //console.log(data);
      if (data.type === "text"){
          console.log(socketOperator.id + ": " + data.message);
          if (data.package === "messenger"){
            sendTextMessageToMessenger(data.sender, serverConfig.operatorName + ": " + data.message);
          }
          if (data.package === "wechat"){
            wechatClient.sendText(data.sender, serverConfig.operatorName + ": " + data.message);
          }
          if (data.package === "line"){
            lineClient.pushText(data.sender, serverConfig.operatorName + ": " + data.message);
          }
          if (data.package === "twilioWhatsApp"){
              console.log("here");

            sendTextMessageToTwilio(data.sender, serverConfig.operatorName + ": " + data.message, "whatsapp");
          }
          if (data.package === "twilioSMS"){
            sendTextMessageToTwilio(data.sender, serverConfig.operatorName + ": " + data.message, "sms");
          }

      } else if (data.type === "image"){
          var filename = "routes/image/"+data.path;
          console.log('filename: ' + filename);
          require("fs").writeFile(filename, data.message, 'base64', function(err) {
            if (err){
                  var jsonMesg = {};
                  jsonMesg.sessionID = data.sender;
                  jsonMesg.photoPath = "nonwhatsapp";
                  jsonMesg.message = serverConfig.serviceTempNotAvailable;

                  socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));

            } else {
              if (data.package === "line"){

                if (ngrokURL === ""){
                  var url = lineConfig.serverUrl+"/"+data.path
                  console.log(url);
                  lineClient.pushImage(data.sender, {
                      originalContentUrl: url,
                      previewImageUrl: url
                  });                  
                } else {
                  var url = ngrokURL+filename
                  console.log(url);
                  lineClient.pushImage(data.sender, {
                      originalContentUrl: url,
                      previewImageUrl: url
                  });                  
                }

              }
              if (data.package === "wechat"){
                var promiseToken = refreshWeChatToken();
                promiseToken.then(function(weChatToken){
                    var promiseUpload = uploadImageToWechat(filename, weChatToken);
                    promiseUpload.then(function(media_id) {
                          var promiseSendImage = sendImageWeChat(data.sender, media_id).then(function(result) {
                            console.log("Wechat Image sent to user: "+data.sender);
                          }, function(err) {
                          var jsonMesg = {};
                          jsonMesg.sessionID = data.sender;
                          jsonMesg.photoPath = "nonwhatsapp";
                          jsonMesg.message = serverConfig.serviceTempNotAvailable;
                          socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));
                          });
                    }, function(err) {
                          var jsonMesg = {};
                          jsonMesg.sessionID = data.sender;
                          jsonMesg.photoPath = "nonwhatsapp";
                          jsonMesg.message = serverConfig.serviceTempNotAvailable;
                          socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));
                    });

                }, function(err) {
                      var jsonMesg = {};
                      jsonMesg.sessionID = data.sender;
                      jsonMesg.photoPath = "nonwhatsapp";
                      jsonMesg.message = serverConfig.serviceTempNotAvailable;
                      socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));
                });


                // uploadImageToWechat(filename, function(reply,media_id){
                //     if (reply != "error"){
                //       wechatClient.sendImage(data.sender, media_id);
                //     } else {
                //             var jsonMesg = {};
                //             jsonMesg.sessionID = data.sender;
                //             jsonMesg.photoPath = "nonwhatsapp";
                //             jsonMesg.message = serverConfig.serviceTempNotAvailable;
                //             socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));

                //     }
                //   }
                // );
              }
              if (data.package === "messenger"){
                sendImageMessageToMessenger(data.sender, filename, function(error, message){
                  if (error === "error"){
                            var jsonMesg = {};
                            jsonMesg.sessionID = data.sender;
                            jsonMesg.photoPath = "nonwhatsapp";
                            jsonMesg.message = serverConfig.serviceTempNotAvailable;
                            socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));
                  }
                });
              }
            }
          });


      }
    });
}

function processMessage(sender, text, package, type) {
        var found = false;
        if (userData != null){
            for(var i = 0; i < userData.user.length; i++) {
              if (userData.user[i].id == sender) {
                  found = true;
                  console.log(userData.user[i].id + " " + userData.user[i].name + " " + userData.user[i].package + " found");
                  break;
              }
            }
        }
        if (found == false){
          var username = "";
          if (package === "messenger"){
            getMessengerUserProfile(sender, function(reply,obj){
              if (reply === "ok"){
                //console.log(obj);
                var name = obj.first_name + obj.last_name;
                userData.user.push({id: sender, name: name, package: package})
                postUserDataToMongooseDB(sender, name, package);
                writeUserJsonFile();
              }
            });
          }
          if (package === "wechat"){
            getWechatUsersDetail(sender, function(reply,obj){
              if (reply === "ok"){
                userData.user.push({id: sender, name: obj.nickname, package: package})
                postUserDataToMongooseDB(sender, obj.nickname, package);
                writeUserJsonFile();
              }
            });

          }
          if (package === "line"){
            getLineUserDetail(sender, function(err, userId, displayName){
              if (err === "ok"){
                userData.user.push({id: sender, name: displayName, package: package})
                postUserDataToMongooseDB(sender, displayName, package);
                writeUserJsonFile();
              }
            });
          }
          if (package === "twilioWhatsApp"){
                userData.user.push({id: sender, name: sender, package: package})
                postUserDataToMongooseDB(sender, sender, package);
                writeUserJsonFile();
          }
          if (package === "twilioSMS"){
                userData.user.push({id: sender, name: sender, package: package})
                postUserDataToMongooseDB(sender, sender, package);
                writeUserJsonFile();
          }
        }

        if (sender === currentActiveOperatorUser){
            if (type === "text"){
                var jsonMesg = {};
                jsonMesg.sessionID = sender;
                jsonMesg.photoPath = "nonwhatsapp";
                jsonMesg.message = text;
                socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));
            } else if (type === "image"){
                var jsonMesg = {};
                jsonMesg.sessionID = sender;
                jsonMesg.photoPath = "nonwhatsapp";
                jsonMesg.message = "📷."+text;
                socketOperator.emit("chatMessageOperatorSessionNonAndroid", JSON.stringify(jsonMesg, null, 4));
            }
        } else {
            found = false;
            var index = 0;
            for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
              if (incomingChatUser[j].sender === sender) {
                found = true;
                index = j;
                break;
              }
            }

            if (found) {
              var lowerCaseInput = text.toLowerCase();
              if (incomingChatUser[index].state === "connected") {
                  var jsonMesg = {};
                  if (type === "text"){
                    jsonMesg.sessionID = sender;
                    jsonMesg.photoPath = "nonwhatsapp";
                    jsonMesg.message = text;
                    incomingChatUser[index].socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                  } else if (type === "image"){
                    jsonMesg.sessionID = sender;
                    jsonMesg.photoPath = "nonwhatsapp";
                    jsonMesg.message = "📷."+text;
                    incomingChatUser[index].socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                  }              

                  if (lowerCaseInput.indexOf(serverConfig.userExitMagicword) > -1){
                    incomingChatUser[index].socket.disconnect();
                    incomingChatUser.splice(index, 1);
                  }
              } else if (incomingChatUser[index].state === "requestServer") {
                if (lowerCaseInput === serverConfig.userExitQueueMagicword){
                    var message = serverConfig.userExitQueueReply;
                    if (package === "messenger"){
                      console.log('Messenger: ' + message);
                      sendTextMessageToMessenger(sender, serverConfig.botName + ": " + message);
                    }
                    if (package === "wechat"){
                      console.log('Wechat: ' + message);
                      wechatClient.sendText(sender, serverConfig.botName + ": " + message);
                    }
                    if (package === "line"){
                      console.log('line: ' + message);
                      lineClient.pushText(sender, serverConfig.botName + ": "  + message);
                    }
                    if (package === "twilioWhatsApp"){
                      console.log('twilio: ' + message);
                      sendTextMessageToTwilio(sender, serverConfig.botName + ": " + message, "whatsapp");
                    }
                    if (package === "twilioSMS"){
                      console.log('twilio: ' + message);
                      sendTextMessageToTwilio(sender, serverConfig.botName + ": " + message, "sms");
                    }
                    incomingChatUser[index].socket.disconnect();
                    incomingChatUser.splice(index, 1);
                } else {
                  incomingChatUser[index].pendingMessage += text + "\n";
                }
              }
            } else {
              if (type === "text"){
                  // only send request to dialogflow if this is text
                  
                  // Log user input to mongoose
                  postTextMessageToMongooseDB(sender, text, package, sender);

                  sendRequestToDialogFlow(package, text, sender, function(reply,status){
                    if (reply != "error"){

                      if (status === "operator_request"){
                        var waitingCount = 0;
                        for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
                          if (incomingChatUser[j].state === "requestServer") {
                            waitingCount ++;
                          }
                        }
                        var message = serverConfig.youAreTheNumber + (waitingCount).toString() + serverConfig.inTheQueue;
                        if (package === "messenger"){
                          console.log('Messenger: ' + reply + "\n\n" + message);
                          sendTextMessageToMessenger(sender, serverConfig.botName + ": " + reply + "\n\n" + message);
                        }
                        if (package === "wechat"){
                          console.log('Wechat: ' + reply + "\n\n" + message);
                          wechatClient.sendText(sender, serverConfig.botName + ": " + reply + "\n\n" + message);
                        }
                        if (package === "line"){
                          console.log('line: ' + reply + "\n\n" + message);
                          lineClient.pushText(sender, serverConfig.botName + ": " + reply + "\n\n" + message);
                        }
                        if (package === "twilioWhatsApp"){
                          console.log('twilio: ' + reply + "\n\n" + message);
                          sendTextMessageToTwilio(sender, serverConfig.botName + ": " + reply + "\n\n" + message, "whatsapp");
                        }
                        if (package === "twilioSMS"){
                          console.log('twilio: ' + reply + "\n\n" + message);
                          sendTextMessageToTwilio(sender, serverConfig.botName + ": " + reply + "\n\n" + message, "sms");
                        }
                        postTextMessageToMongooseDB(sender, serverConfig.botName + ": " + reply + "\n\n" + message, package, "robot");

                      } else if (status === "operator_not_login") {
                        var message = serverConfig.OperatorUnavailableMesg;
                        if (package === "messenger"){
                          console.log('Messenger: ' + message);
                          sendTextMessageToMessenger(sender, serverConfig.botName + ": " + message);
                        }
                        if (package === "wechat"){
                          console.log('Wechat: ' + message);
                          wechatClient.sendText(sender, serverConfig.botName + ": " + message);
                        }
                        if (package === "line"){
                          console.log('line: ' + message);
                          lineClient.pushText(sender, serverConfig.botName + ": " + message);
                        }
                        if (package === "twilioWhatsApp"){
                          console.log('twilio: ' + message);
                          sendTextMessageToTwilio(sender, serverConfig.botName + ": " + message, "whatsapp");
                        }
                        if (package === "twilioSMS"){
                          console.log('twilio: ' + message);
                          sendTextMessageToTwilio(sender, serverConfig.botName + ": " + message, "sms");
                        }
                        postTextMessageToMongooseDB(sender, serverConfig.botName + ": " + message, package, "robot");

                      } else {
                        console.log(reply);
                        if (package === "messenger"){
                          sendTextMessageToMessenger(sender, serverConfig.botName + ": " + reply);
                        }
                        if (package === "wechat"){
                          wechatClient.sendText(sender, serverConfig.botName + ": " + reply);
                        }
                        if (package === "line"){
                          lineClient.pushText(sender, serverConfig.botName + ": " + reply);
                        }
                        if (package === "twilioWhatsApp"){
                          sendTextMessageToTwilio(sender, serverConfig.botName + ": " + reply, "whatsapp");
                        }
                        if (package === "twilioSMS"){
                          sendTextMessageToTwilio(sender, serverConfig.botName + ": " + reply, "sms");
                        }
                        postTextMessageToMongooseDB(sender, serverConfig.botName + ": " + reply, package, "robot");
                      }
                    }
                  });            
                } else if (type === "image"){
                  // image is not send to dialogflow, reply with message
                        var message = serverConfig.pleaseSendImageWhenOperatorIsConnected;
                        if (package === "messenger"){
                          sendTextMessageToMessenger(sender, serverConfig.botName + ": " + message);
                        }
                        if (package === "wechat"){
                          wechatClient.sendText(sender, serverConfig.botName + ": " + message);
                        }
                        if (package === "line"){
                          lineClient.pushText(sender, serverConfig.botName + ": " + message);
                        }
                }
            }
        }
        
}

function sendImageMessageToMessenger(recipientId, file_loc, callback){
    let fs = require('fs');
    var readStream = fs.createReadStream(file_loc);
    var messageData = {
        recipient : {
            id : recipientId
        },
        message : {
            attachment : {
                type : "image",
                payload :{}
            }
        },
        filedata:readStream
    }

    var endpoint = "https://graph.facebook.com/v2.6/me/messages?access_token=" + messengerConfig.pageAccessToken;
    var r = request.post(endpoint, function(err, httpResponse, body) {
        if (err) {
          callback("error", "upload failed, " + err);
        } else {
          callback("ok", "upload successfull, " + body);

        }
    });
    var form = r.form();
    form.append('recipient', JSON.stringify(messageData.recipient));
    form.append('message', JSON.stringify(messageData.message));
    form.append('filedata', messageData.filedata); //no need to stringify!
}

function sendTextMessageToTwilio(number, message,messageType){
  if (messageType==="whatsapp"){
      twilioClient.messages
      .create({
        body: message,
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+' + number
      })
      //.then(message => console.log(message.sid))
      .done();
  }
  if (messageType==="sms"){
      twilioClient.messages
      .create({
        body: message,
        from: twilioConfig.smsNumber,
        to: '+' + number
      })
      //.then(message => console.log(message.sid))
      .done();      
  }
}


function sendTextMessageToMessenger(sender, text) {
    let messageData = { text:text }
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token:messengerConfig.pageAccessToken},
      method: 'POST',
    json: {
        recipient: {id:sender},
      message: messageData,
    }
  }, function(error, response, body) {
    if (error) {
        console.log('Error sending messages: ', error)
    } else if (response.body.error) {
        console.log('Error: ', response.body.error)
      }
    })
}

function postTextMessageToMongooseDB(sender, text, incomingApp, nickname) {
  var jsonMesg = {};
  jsonMesg.type = incomingApp;
  jsonMesg.phone_number = sender;
  jsonMesg.message = text;
  jsonMesg.nickname = nickname;
  var postData = JSON.stringify(jsonMesg)
  //console.log(postData);

  var options = {
    hostname: serverConfig.mongooseUrl,
    port: serverConfig.mongoosePort,
    path: '/chat/request',
    method: 'POST',
    headers: {
         'Content-Type': 'application/json',
         'Content-Length': postData.length,
         'Authorization': 'Bearer '+serverConfig.meanToken
       },
    rejectUnauthorized: false, 
  };

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);

    res.on('data', (d) => {
      //process.stdout.write(d);
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });

  req.write(postData);
  req.end();
}

function deleteUserDataToMongooseDB(id) {
  var jsonMesg = {};
  jsonMesg.id = id;
  var postData = querystring.stringify(jsonMesg)

  var options = {
    hostname: serverConfig.mongooseUrl,
    port: serverConfig.mongoosePort,
    path: '/chat/contact/'+id,
    method: 'DELETE',
    headers: {
         'Content-Type': 'application/x-www-form-urlencoded',
         'Content-Length': postData.length,
         'Authorization': 'Bearer '+serverConfig.meanToken
       },
    rejectUnauthorized: false, 
  };

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);

    res.on('data', (d) => {
      //process.stdout.write(d);
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });

  req.write(postData);
  req.end();
}

function postUserDataToMongooseDB(id, name, package) {
  var jsonMesg = {};
  jsonMesg.id = id;
  jsonMesg.name = name;
  jsonMesg.package = package;
  var postData = JSON.stringify(jsonMesg)
  console.log(postData);

  var options = {
    hostname: serverConfig.mongooseUrl,
    port: serverConfig.mongoosePort,
    path: '/chat/contact',
    method: 'POST',
    headers: {
         'Content-Type': 'application/json',
         'Content-Length': postData.length,
         'Authorization': 'Bearer '+serverConfig.meanToken
       },
    rejectUnauthorized: false, 
  };

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);

    res.on('data', (d) => {
      //process.stdout.write(d);
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });

  req.write(postData);
  req.end();
}

function putBroadcastResultToMongooseDB(jsonMesg,jobId) {
  console.log(jsonMesg);
  //var putData = querystring.stringify(jsonMesg);
  var putData = JSON.stringify(jsonMesg);
  console.log(putData);

  var options = {
    hostname: serverConfig.mongooseUrl,
    port: serverConfig.mongoosePort,
    path: '/chat/updatebroadcast/'+jobId,
    method: 'PUT',
    headers: {
         'Content-Type': 'application/json',
         'Content-Length': putData.length,
         'Authorization': 'Bearer '+serverConfig.meanToken
       },
    rejectUnauthorized: false, 
  };

  console.log(options);

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);

    res.on('data', (d) => {
      //process.stdout.write(d);
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });

  req.write(putData);
  req.end();
}

function getMessengerUserProfile(userid, callback) {
    request({
      url: 'https://graph.facebook.com/v2.6/'+userid,
         qs: {
          fields: 'first_name,last_name,profile_pic,id',
          access_token: messengerConfig.pageAccessToken
        },

      method: 'GET',
    json: true
  }, function(error, response, body) {
    if (error) {
        console.log('Error getting MessengerUserProfile: ', error)
        callback("error", error)
    } else if (response.body.error) {
        console.log('Error: ', response.body.error)
        callback("error", response.body.error)
    } else {
        callback("ok", body)
    }
    })
}

function connectToCsServer(package, sender, text){
    console.log("Connect to CS Server from " + package);
    var socket;

    if (serverConfig.socketIoURL.indexOf("https") > -1){
      socket = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { secure: true, reconnect: true, rejectUnauthorized : false });

    } else {
      socket = require('socket.io-client')(serverConfig.socketIoURL+":"+serverConfig.socketIoPort, { forceNew: true });
    }

    var index=0;
    var found = false;

    for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
          if (incomingChatUser[j].sender === sender) {
            index = j;
            found = true;
            console.log("Old entry found, incomingChatUser.length: " + incomingChatUser.length);
          }
    }

    if (found){
        console.log("Old entry deleted, incomingChatUser.length: " + incomingChatUser.length);
        incomingChatUser.splice(index, 1);
    }

    // request server
    incomingChatUser.push(new ChatUser(package, socket, sender, "requestServer", true, text))
    //console.log(incomingChatUser);

    var jsonMesg = {};
    jsonMesg.sender = sender;
    jsonMesg.package = package;
    //socket.emit("user", JSON.stringify(jsonMesg, null, 4));
    socket.connect();
    socket.emit("user", jsonMesg);
    console.log("socket id debug is: " + socket.id);



    socket.on('disconnect', function(sender){
      console.log("socket.on disconnect from sender: " + sender + " Socket id: "+ socket.id);

      if (sender === "transport close"){
          incomingChatUser.splice(0, incomingChatUser.length);
      } else {
        var index;
        var found = false;
        for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
            console.log(incomingChatUser[j].sender);
            if (incomingChatUser[j].sender === sender) {
              index = j;
              found = true;
            }
        }

        if (found){
          console.log("Disconnect socket: " + incomingChatUser[index].socket.id);
          incomingChatUser.splice(index, 1);
        }
      }

    });

    // admin connected
    socket.on('adminConnected', function(){
      console.log(socket.id + ": " + 'adminConnected');
      for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
          //console.log(incomingChatUser[j].socket.id);
          if (incomingChatUser[j].socket.id === socket.id) {
            var jsonMesg = {};
            jsonMesg.sessionID = sender;
            jsonMesg.photoPath = "nonwhatsapp";
            jsonMesg.message = incomingChatUser[j].pendingMessage;
            socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
            incomingChatUser[j].state = "connected";
            break;
          }
      }

      var waitingUsers = [];
      for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
        if (incomingChatUser[j].state === "requestServer") {
          waitingUsers.push(new WaitingUser(incomingChatUser[j].package,incomingChatUser[j].sender));
        }
      }

      for(var j = 0 , len = waitingUsers.length ; j < len ; j++){
        var message = serverConfig.youAreTheNumber + (j+1).toString() + serverConfig.inTheQueue;
        if (waitingUsers[j].package === "messenger"){
          sendTextMessageToMessenger(waitingUsers[j].sender, message);
        }
        if (waitingUsers[j].package === "wechat"){
          wechatClient.sendText(waitingUsers[j].sender, message);
        }
        if (waitingUsers[j].package === "line"){
          lineClient.pushText(waitingUsers[j].sender, message);
        }
        if (waitingUsers[j].package === "twilioWhatsApp"){
          sendTextMessageToTwilio(waitingUsers[j].sender, message, "whatsapp");
        }
        if (waitingUsers[j].package === "twilioSMS"){
          sendTextMessageToTwilio(waitingUsers[j].sender, message, "sms");
        }
      }

    });

    // admin send message to user
    socket.on('adminchat', function(data){
      if (data.type === "text"){
          console.log(socket.id + ":: " + data.message);
          var lowerCaseInput = data.message.toLowerCase();
          if ((lowerCaseInput.indexOf(serverConfig.operatorExitMagicword1) > -1) || (lowerCaseInput.indexOf(serverConfig.operatorExitMagicword2) > -1)){
            for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
              if (incomingChatUser[j].socket.id === socket.id) {
                incomingChatUser.splice(j, 1);
                console.log("socket.id entry deleted and disconnected: " + socket.id);
                break;
              }
            }
            socket.disconnect();
          }
          if (data.package === "messenger"){
            sendTextMessageToMessenger(sender, serverConfig.operatorName + ": " + data.message);
          }
          if (data.package === "wechat"){
            wechatClient.sendText(sender, serverConfig.operatorName + ": " + data.message);
          }
          if (data.package === "line"){
            lineClient.pushText(sender, serverConfig.operatorName + ": " + data.message);
          }
          if (data.package === "twilioWhatsApp"){
            sendTextMessageToTwilio(sender, serverConfig.operatorName + ": " + data.message, "whatsapp");
          }
          if (data.package === "twilioSMS"){
            sendTextMessageToTwilio(sender, serverConfig.operatorName + ": " + data.message, "sms");
          }

      } else if (data.type === "image"){
          //console.log(socket.id + ", type: " + data.type);
          //console.log(socket.id + ", path: " + data.path);
          //console.log(socket.id + ", message: " + data.message);
          var filename = "routes/image/"+data.path;
          require("fs").writeFile(filename, data.message, 'base64', function(err) {
            if (err){
                  for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
                      if (incomingChatUser[j].socket.id === socket.id) {
                        var jsonMesg = {};
                        jsonMesg.sessionID = sender;
                        jsonMesg.photoPath = "nonwhatsapp";
                        jsonMesg.message = serverConfig.serviceTempNotAvailable;
                        socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                        break;
                      }
                  }
            } else {
              if (data.package === "line"){

                if (ngrokURL === ""){
                  var url = lineConfig.serverUrl+"/"+data.path
                  console.log(url);
                  lineClient.pushImage(data.sender, {
                      originalContentUrl: url,
                      previewImageUrl: url
                  });                  
                } else {
                  var url = ngrokURL+filename
                  console.log(url);
                  lineClient.pushImage(data.sender, {
                      originalContentUrl: url,
                      previewImageUrl: url
                  });                  
                }

              }
              if (data.package === "wechat"){
                var promiseToken = refreshWeChatToken();
                promiseToken.then(function(weChatToken){
                    var promiseUpload = uploadImageToWechat(filename, weChatToken);
                    promiseUpload.then(function(media_id) {
                          var promiseSendImage = sendImageWeChat(data.sender, media_id).then(function(result) {
                            console.log("Wechat Image sent to user: "+data.sender);
                          }, function(err) {
                            for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
                                if (incomingChatUser[j].socket.id === socket.id) {
                                  var jsonMesg = {};
                                  jsonMesg.sessionID = sender;
                                  jsonMesg.photoPath = "nonwhatsapp";
                                  jsonMesg.message = serverConfig.serviceTempNotAvailable;
                                  socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                                  break;
                                }
                            }
                          });
                    }, function(err) {
                      for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
                          if (incomingChatUser[j].socket.id === socket.id) {
                            var jsonMesg = {};
                            jsonMesg.sessionID = sender;
                            jsonMesg.photoPath = "nonwhatsapp";
                            jsonMesg.message = serverConfig.serviceTempNotAvailable;
                            socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                            break;
                          }
                      }
                    });

                }, function(err) {
                      for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
                          if (incomingChatUser[j].socket.id === socket.id) {
                            var jsonMesg = {};
                            jsonMesg.sessionID = sender;
                            jsonMesg.photoPath = "nonwhatsapp";
                            jsonMesg.message = serverConfig.serviceTempNotAvailable;
                            socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                            break;
                          }
                      }
                });

                // uploadImageToWechat(filename, function(reply,media_id){
                //     if (reply != "error"){
                //       wechatClient.sendImage(sender, media_id);
                //     } else {
                //       for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
                //           if (incomingChatUser[j].socket.id === socket.id) {
                //             var jsonMesg = {};
                //             jsonMesg.sessionID = sender;
                //             jsonMesg.photoPath = "nonwhatsapp";
                //             jsonMesg.message = serverConfig.serviceTempNotAvailable;
                //             socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                //             break;
                //           }
                //       }
                //     }
                //   }
                // );
              }
              if (data.package === "messenger"){
                sendImageMessageToMessenger(sender, filename, function(error, message){
                  if (error === "error"){
                      for(var j = 0 , len = incomingChatUser.length ; j < len ; j++){
                          if (incomingChatUser[j].socket.id === socket.id) {
                            var jsonMesg = {};
                            jsonMesg.sessionID = sender;
                            jsonMesg.photoPath = "nonwhatsapp";
                            jsonMesg.message = serverConfig.serviceTempNotAvailable;
                            socket.emit("chat message", JSON.stringify(jsonMesg, null, 4));
                            break;
                          }
                      }
                  }
                });
              }
            }
          });


      }
    });
}


function sendRequestToDialogFlow(package, text, sender, callback){
  detectLanguage(text, function(detectedLanguage){
    console.log(detectedLanguage);
    if (detectedLanguage != "error"){
      if ((detectedLanguage === "zh-CN")||(detectedLanguage === "zh-HK")||(detectedLanguage === "zh-TW")){
        detectedLanguage = "zh-CN"
      } 
    }else {
        detectedLanguage = "en"
    }

    console.log(detectedLanguage);

      var dialogFlow = apiai(dialogflowConfig.accessToken, {
          language: detectedLanguage
      });

        var request = dialogFlow.textRequest(text, {
          sessionId: sender
        });

        request.on('response', function(response) {
          var type = "bot"
          var diaglogFlowJsonResponse = JSON.stringify(response, null, 4);
          var jsonParsed = JSON.parse(diaglogFlowJsonResponse);
          if (jsonParsed.result.contexts.length > 0){
            for(var j = 0 , len = jsonParsed.result.contexts.length ; j < len ; j++){
              var name = jsonParsed.result.contexts[j].name
              //console.log(name);
              if (name === "operator_request"){
                if (operatorHasLogin) {
                  connectToCsServer(package, sender, text);
                  type = "operator_request"
                  break;
                } else {
                  type = "operator_not_login"
                  break;
                }
              }
            }
          }
          callback(response.result.fulfillment.speech,type)
        });

        request.on('error', function(error) {
          callback("error","nil")
      });

      request.end();
    

  });


}


function processLineMessage() {
  lineBot.on('message', function(event) {
    var sender = event.source.userId;
    if (event.message.type === 'text') {
        var text = event.message.text;
        console.log("Line: " + text);
        if ((text != "Hello, world")&&(sender != "Udeadbeefdeadbeefdeadbeefdeadbeef")){
          processMessage(sender, text, "line", "text");
        }
    } else if (event.message.type === 'image'){
      event.message.content().then(function (content) {
        var text = "data:" + "image/jpeg" + ";base64," + content.toString('base64');
        processMessage(sender, text, "line", "image");
      });
    } else {
      event.reply(event.message.type + lineConfig.TypeNotSupportedReply);
    }
  });

  lineBot.on('follow',   function (event) {
    console.log(event);
    if (event.type === "follow"){
      var follower = event.source.userId;
      getLineUserDetail(follower, function(err, userId, displayName){
        if (err === "ok"){
          console.log(userId + ": " + displayName);
        }
      });
    }
  });
  lineBot.on('unfollow', function (event) {
    console.log(event);
    if (event.type === "unfollow"){
      var follower = event.source.userId;
      console.log("User " + follower + " unfollows");
      
      deleteUserDataToMongooseDB(follower);
      var index = 0;
      var found = false;
      if (userData != null){
        for(var i = 0; i < userData.user.length; i++) {
          if (userData.user[i].id == follower) {
            found = true;
            index = i;
            console.log("delete user: " + userData.user[i].id + " " + userData.user[i].name + " " + userData.user[i].package);
            break;
          }
        }
        if (found){
          userData.user.splice(index, 1);
          writeUserJsonFile();
        }
      }

    }
  });

}


/*
tokenManager.on('token', function(token) {
  accessToken = token;
  console.log("accessToken: " + accessToken);
});
 
tokenManager.on('error', function(error) {
  // maybe network error or wechat return errcode
  console.error(error);
});

tokenManager.refresh(function(token) {});
 
// make token manager start work
tokenManager.start();
*/


var app = express();

app.set('port', (process.env.PORT || serverConfig.serverPort))

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Content-Disposition, Accept");
  res.header("Access-Control-Expose-Headers", "Content-Disposition, filename");
  // res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");

  next();

});

// Index route
app.get('/', function (req, res) {
  res.send('Hello world, I am a airpointChatServer')
})

// Image routes
app.use('/image', express.static(__dirname + '/image'));
var path = require("path");
console.log("__dirname = %s", path.resolve(__dirname));

// Line Routes
app.post('/linewebhook', lineBot.parser());
processLineMessage();

//sendTwilioTextMessage("+85292279793", "Hi Johnson!");

readUserJsonFile();
//initSocketIo();
setupOperatorChannel();

// getWechatUsersOpenId(function(reply,media_id){
//   for(var j = 0 , len = weChatUserOpenId.length ; j < len ; j++){
//     getWechatUsersDetail(weChatUserOpenId[j])
//   }
// })

function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

// CSP register and unregister routes
app.post('/api/csp/register', jsonParser, (req, res) => {
  var jsonMesg = {};
  if ((req.body.sessionID === serverConfig.cspToken)&&(req.body.action === "register")) {
    operatorHasLogin = true
    jsonMesg.success = true;
    res.send(jsonMesg)
  } else {
    jsonMesg.success = false;
    res.send(jsonMesg)
  }
});

app.post('/api/csp/unregister', jsonParser, (req, res) => {
  var jsonMesg = {};
  if ((req.body.sessionID === serverConfig.cspToken)&&(req.body.action === "unregister")) {
    operatorHasLogin = false
    jsonMesg.success = true;
    res.send(jsonMesg)
  } else {
    jsonMesg.success = false;
    res.send(jsonMesg)
  }
});

app.get('/api/csp/getuserdata', (req, res) => {
  var jsonMesg = {};
  if ((req.query.sessionID === serverConfig.cspToken)&&(req.query.action === "getuserdata")&&(userData != null)) {    
    res.send(userData)
  } else {
    jsonMesg.success = false;
    res.send(jsonMesg)
  }
});

app.get('/api/csp/refreshSocketIo', (req, res) => {
  var jsonMesg = {};
  jsonMesg.socketId = socketOperator.id;
  res.send(jsonMesg)
  socketOperator.emit("user", "operatorSessionUserNonAndroid");
});

app.post('/wechatBroadcastwebhook', bodyParser.json({limit: '16mb'}), (req, res) => {
  var jsonMesg = {};
  var jobId = uuidv1();

  if (req.body.sessionID === serverConfig.cspToken) {
    var jsonResultArray = [];

    jsonMesg.jobID = jobId;
    jsonMesg.jobStatus = "Success";
    res.send(jsonMesg);
    var j = 0;
    var promiseSleep = sleep(1000);
    promiseSleep.then(result=>{
      req.body.contactListJson.contactList.forEach(function(table) {

      var name = table.name;
      var wechatId = table.wechatId;

      var found = false;
      if (userData != null){
        for(var i = 0; i < userData.user.length; i++) {
          if (userData.user[i].id == wechatId) {
            found = true;
            console.log(userData.user[i].id + " " + userData.user[i].name + " " + userData.user[i].package + " found");
            break;
          }
        }
      }

      if (found===false){
        jsonResultElement.Phone = wechatId;
        jsonResultElement.Result = "User not found in this group";
        jsonResultArray.push(jsonResultElement);
        if (j===req.body.contactListJson.contactList.length){
          jsonMesg.jobID = jobId;
          jsonMesg.Results = jsonResultArray;
          jsonMesg.jobStatus = "Completed";
          putBroadcastResultToMongooseDB(jsonMesg, jobId);
        }
      } else if ((name)&&(wechatId)){
        if ((req.body.imagefilename) && (req.body.imagefileBase64)&&(req.body.imagefilename!="")&&((req.body.imagefileBase64)!="")){
          var filename = "routes/image/"+req.body.imagefilename;
          console.log('filename: ' + filename);
    
          require("fs").writeFile(filename, req.body.imagefileBase64, 'base64', function(err) {
            if (err){
              jsonMesg.jobID = uuidv1();
              jsonMesg.Results = jsonResultArray;
              jsonMesg.jobStatus = "Image save/decode failed";
              res.send(jsonMesg)
              putBroadcastResultToMongooseDB(jsonMesg, jobId);
            } else {
                var promiseToken = refreshWeChatToken();
                promiseToken.then(function(weChatToken){
                    var promiseUpload = uploadImageToWechat(filename, weChatToken);
                    promiseUpload.then(function(media_id) {
                          var promiseSendImage = sendImageWeChat(wechatId, media_id).then(function(result) {
                            console.log("Wechat Image sent to user: "+wechatId);
                            var jsonResultElement = {};
                            jsonResultElement.Phone = wechatId;
                            jsonResultElement.Result = "Success";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            console.log("j="+j);

                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
                          }, function(err) {
                            var jsonResultElement = {};
                            jsonResultElement.Phone = wechatId;
                            jsonResultElement.Result = "Send Image Failed";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
                          });
                    }, function(err) {
                      var jsonResultElement = {};
                      jsonResultElement.Phone = wechatId;
                      jsonResultElement.Result = "Upload Image to Wechat Server Failed";
                      jsonResultArray.push(jsonResultElement);
                      j++;

                      if (j===req.body.contactListJson.contactList.length){
                        jsonMesg.jobID = jobId;
                        jsonMesg.Results = jsonResultArray;
                        jsonMesg.jobStatus = "Completed";
                        putBroadcastResultToMongooseDB(jsonMesg, jobId);
                      }

                  });

                }, function(err) {
                  var jsonResultElement = {};
                  jsonResultElement.Phone = wechatId;
                  jsonResultElement.Result = "Wechat Token Refresh failed";
                  jsonResultArray.push(jsonResultElement);
                  j++;
                  if (j===req.body.contactListJson.contactList.length){
                    jsonMesg.jobID = jobId;
                    jsonMesg.Results = jsonResultArray;
                    jsonMesg.jobStatus = "Completed";
                    putBroadcastResultToMongooseDB(jsonMesg, jobId);
                  }
                });
            }
          });
        } else if (req.body.message){
          var finalMessage = "";
          if (req.body.prependContactName==="Y"){
            finalMessage = "Dear " + name + ",\n\n" + req.body.message;

          } else {
            finalMessage = req.body.message;
          }
          var promiseToken = refreshWeChatToken();
          promiseToken.then(function(weChatToken){
              var promiseSendText = sendTextWeChat(wechatId, finalMessage).then(function(result) {
                            console.log("Wechat Text sent to user: "+wechatId);
                            var jsonResultElement = {};
                            jsonResultElement.Phone = wechatId;
                            jsonResultElement.Result = "Success";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            console.log("j="+j);

                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
                          }, function(err) {
                            var jsonResultElement = {};
                            jsonResultElement.Phone = wechatId;
                            jsonResultElement.Result = "Send Text Failed";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
              });
            });
          }
        }
      });
    });
  } else {
    jsonMesg.jobID = jobId;
    jsonMesg.jobStatus = "Wrong token";
    res.send(jsonMesg)
  }
});

app.post('/lineBroadcastwebhook', bodyParser.json({limit: '16mb'}), (req, res) => {
  var jsonMesg = {};
  var jobId = uuidv1();

  if (req.body.sessionID === serverConfig.cspToken) {
    var jsonResultArray = [];

    jsonMesg.jobID = jobId;
    jsonMesg.jobStatus = "Success";
    res.send(jsonMesg);
    var j = 0;
    var promiseSleep = sleep(1000);
    promiseSleep.then(result=>{
      req.body.contactListJson.contactList.forEach(function(table) {

      var name = table.name;
      var lineId = table.lineId;

      var found = false;
      if (userData != null){
        for(var i = 0; i < userData.user.length; i++) {
          if (userData.user[i].id == lineId) {
            found = true;
            console.log(userData.user[i].id + " " + userData.user[i].name + " " + userData.user[i].package + " found");
            break;
          }
        }
      }

      if (found===false){
        jsonResultElement.Phone = lineId;
        jsonResultElement.Result = "User not found in this group";
        jsonResultArray.push(jsonResultElement);
        if (j===req.body.contactListJson.contactList.length){
          jsonMesg.jobID = jobId;
          jsonMesg.Results = jsonResultArray;
          jsonMesg.jobStatus = "Completed";
          putBroadcastResultToMongooseDB(jsonMesg, jobId);
        }
      } else if ((name)&&(lineId)){
        if ((req.body.imagefilename) && (req.body.imagefileBase64)&&(req.body.imagefilename!="")&&((req.body.imagefileBase64)!="")){
          var filename = "routes/image/"+req.body.imagefilename;
          console.log('filename: ' + filename);
    
          require("fs").writeFile(filename, req.body.imagefileBase64, 'base64', function(err) {
            if (err){
              jsonMesg.jobID = uuidv1();
              jsonMesg.Results = jsonResultArray;
              jsonMesg.jobStatus = "Image save/decode failed";
              res.send(jsonMesg)
              putBroadcastResultToMongooseDB(jsonMesg, jobId);
            } else {
                var promiseToken = refreshWeChatToken();
                var url;
                if (ngrokURL === ""){
                  url = lineConfig.serverUrl+"/"+req.body.imagefilename
                } else {
                  url = ngrokURL+filename
                }


                var promiseSendImage = sendImageLine(lineId, url).then(function(result) {
                            console.log("Line Image sent to user: "+lineId);
                            var jsonResultElement = {};
                            jsonResultElement.Phone = lineId;
                            jsonResultElement.Result = "Success";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            console.log("j="+j);

                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
                          }, function(err) {
                            var jsonResultElement = {};
                            jsonResultElement.Phone = lineId;
                            jsonResultElement.Result = "Send Image Failed";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
                });
            }
          });
        } else if (req.body.message){
          var finalMessage = "";
          if (req.body.prependContactName==="Y"){
            finalMessage = "Dear " + name + ",\n\n" + req.body.message;

          } else {
            finalMessage = req.body.message;
          }
          var promiseToken = refreshWeChatToken();
          var promiseSendText = sendTextLine(lineId, finalMessage).then(function(result) {
                            console.log("Line Text sent to user: "+lineId);
                            var jsonResultElement = {};
                            jsonResultElement.Phone = lineId;
                            jsonResultElement.Result = "Success";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            console.log("j="+j);

                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
                          }, function(err) {
                            var jsonResultElement = {};
                            jsonResultElement.Phone = lineId;
                            jsonResultElement.Result = "Send Text Failed";
                            jsonResultArray.push(jsonResultElement);
                            j++;
                            if (j===req.body.contactListJson.contactList.length){
                              jsonMesg.jobID = jobId;
                              jsonMesg.Results = jsonResultArray;
                              jsonMesg.jobStatus = "Completed";
                              putBroadcastResultToMongooseDB(jsonMesg, jobId);
                            }
            });
          }
        }
      });
    });
  } else {
    jsonMesg.jobID = jobId;
    jsonMesg.jobStatus = "Wrong token";
    res.send(jsonMesg)
  }
});


// Twilio Routes
app.post('/twiliowebhook', urlencodedParser, (req, res) => {
  const twiml = new MessagingResponse();

  //twiml.message('The Robots are coming! Head for the hills!');
  var text = req.body.Body
  if (req.body.From.indexOf("whatsapp:+") > -1){
      var sender = req.body.From.replace("whatsapp:+", "");
      processMessage(sender, text, "twilioWhatsApp", "text");
  } else {
    // SMS
      var sender = req.body.From.replace("+", "");
      processMessage(sender, text, "twilioSMS", "text");

  }
  console.log('Twilio: ' + text);        
  console.log('From: ' + sender);

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

app.get('/messengerwebhook', urlencodedParser, (req, res) => {
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === messengerConfig.verifyToken) {    
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);  
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

app.post('/messengerwebhook', jsonParser, function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
      let event = req.body.entry[0].messaging[i]
      let sender = event.sender.id
      //console.log(event.message);
      if (event.message) {
        if (event.message.text) {
          let text = event.message.text
          console.log('Messenger: ' + text);        
          console.log('From: ' + sender);
          // getMessengerUserProfile(sender, function(result) {
          //   console.log(result);
          // });
          processMessage(sender, text, "messenger", "text");
        } else if ((event.message.attachments) && (event.message.attachments[0].type === "image")){
          //console.log(event.message.attachments[0].payload.url);
          var https = require('https');

          https.get(event.message.attachments[0].payload.url, (resp) => {
              resp.setEncoding('base64');
              body = "data:" + resp.headers["content-type"] + ";base64,";
              resp.on('data', (data) => { body += data});
              resp.on('end', () => {
                  //console.log(body);
                  processMessage(sender, body, "messenger", "image");
              });
          }).on('error', (e) => {
              console.log(`Got error: ${e.message}`);
          });

        } else {
          sendTextMessageToMessenger(sender, serverConfig.botName + ": " + serverConfig.notSupport);
        }
      }
    }
    res.sendStatus(200)
})

function refreshWeChatToken(){
    return new Promise(function(resolve, reject) {
      // Do async job
      wechatClient._refreshTokenWhenExpired();
      resolve(wechatClient._accessToken);
      //console.log("wechattoken="+wechatClient._accessToken);
    })
}

function sendImageWeChat(sender,media_id){
    return new Promise(function(resolve, reject) {
      // Do async job
      wechatClient.sendImage(sender, media_id).catch(error=> {
          reject(error);
      })
      resolve(true);
    })
}

function sendTextWeChat(sender,message){
    return new Promise(function(resolve, reject) {
      // Do async job
      wechatClient.sendText(sender, message).catch(error=> {
          reject(error);
      })
      resolve(true);
    })
}

function sendImageLine(lineId,url){
    return new Promise(function(resolve, reject) {
      // Do async job
      lineClient.pushImage(lineId, {
        originalContentUrl: url,
        previewImageUrl: url
      }).catch(error=> {
          reject(error);
      })
      resolve(true);
    })
}

function sendTextLine(lineId,finalMessage){
    return new Promise(function(resolve, reject) {
      // Do async job
      lineClient.pushText(lineId, finalMessage).catch(error=> {
          reject(error);
      })
      resolve(true);
    })
}

function uploadImageToWechat(filename, accessToken){
        var formData = {
          media: require("fs").createReadStream(filename),
        };

        var options = {
                url:'https://api.weixin.qq.com/cgi-bin/media/upload?access_token='+ accessToken +'&type=image',
                formData: formData
        };

        // Return new promise 
        return new Promise(function(resolve, reject) {
          // Do async job
          request.post(options, function (err, resp, body) {
                if (err) {
                  reject(err);
                  //console.log("error in http post");
                } else {
                  resolve(JSON.parse(body).media_id);
                  //var obj = JSON.parse(body);
                  //console.log(obj.media_id);
                  //callback("ok", obj.media_id);
                }
            });
        })
}

function getWechatUsersOpenId(callback){
  wechatClient._refreshTokenWhenExpired().then(function () {
      if (wechatClient._accessToken){
        request.get({
          url:'https://api.weixin.qq.com/cgi-bin/user/get?access_token='+ wechatClient._accessToken
          },
          function optionalCallback(err, body) {
              if (err) {
                console.log("error in http get");
                callback("error", err)
              } else {
                //console.log(body);
                 var obj = JSON.parse(body.body);
                 for(var j = 0 , len = obj.data.openid.length ; j < len ; j++){
                    console.log(obj.data.openid[j]);
                    weChatUserOpenId.push(obj.data.openid[j])
                 }
                 callback("ok", obj.data.openid);
              }
          });
      } else {
        console.log("'token refresh failed");
        callback("error", "access token not valid");
      }
  });
}

function getWechatUsersDetail(openid, callback){
  wechatClient._refreshTokenWhenExpired().then(function () {
      if (wechatClient._accessToken){
        request.get({
          url:'https://api.weixin.qq.com/cgi-bin/user/info?access_token='+ wechatClient._accessToken + "&openid=" + openid + "&lang=zh_CN"
          },
          function optionalCallback(err, body) {
              if (err) {
                console.log("error in http get");
              }else {
                 var obj = JSON.parse(body.body);
                 var sex = "male"
                 if (obj.sex === "0"){
                  sex = "female"
                 }
                 callback("ok", obj)
                 //wechatUserDetail.push(new weChatUserInfo(obj.nickname, sex, obj.language, obj.city, obj.province, obj.country))
                 //console.log(obj.nickname + "," + sex + "," + obj.language + "," + obj.city + "," + obj.province + "," + obj.country);
              }
          });
      } else {
        console.log("'token refresh failed");
      }
  });
}

function getLineUserDetail(userid, callback){
  if (lineConfig.channelAccessToken){
        request.get({
          url:'https://api.line.me/v2/bot/profile/'+ userid,
          headers: {
            'Authorization': 'Bearer ' + lineConfig.channelAccessToken
          }
        },
        function optionalCallback(err, body) {
              if (err) {
                console.log("error in http get");
                callback("error", err)
              }else {
                //console.log(body.body);

                var obj = JSON.parse(body.body);
                //console.log(obj);

                callback("ok", obj.userId, obj.displayName)
              }
        });
  }
}

function readUserJsonFile(){
  try {
     userData = require("../"+serverConfig.userDataFilename);
     console.log(userData);
  } catch ( err ) {
     console.log(serverConfig.userDataFilename + " not found");
     userData={"user":[]};
  }
}

function writeUserJsonFile(){
  if (userData != null){
      var json = JSON.stringify(userData);
      var fs = require('fs');
      fs.writeFile(serverConfig.userDataFilename, json, 'utf8', function(err) {
        if (err) throw err;
        console.log('complete');
        }
      );
  }
}

// WeChat Routes
app.use(express.query());
app.use('/wechatwebhook', wechat(wechatConfigurations, 
  wechat.text(function (info, req, res, next) {
    //console.log(info);    
    res.reply("");
    processMessage(info.FromUserName, info.Content, "wechat", "text");
  }).image(function (info, req, res, next) {
    res.reply("");
    //console.log(info);
    // request.get(info.PicUrl, function (error, response, body) {
    //   if (!error && response.statusCode == 200) {
    //       data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
    //       console.log(data);
    //       processMessage(info.FromUserName, data, "wechat", "image");
    //   }
    // });
    var http = require('http');

    http.get(info.PicUrl, (resp) => {
        resp.setEncoding('base64');
        body = "data:" + resp.headers["content-type"] + ";base64,";
        resp.on('data', (data) => { body += data});
        resp.on('end', () => {
            //console.log(body);
            processMessage(info.FromUserName, body, "wechat", "image");
        });
    }).on('error', (e) => {
        console.log(`Got error: ${e.message}`);
    });
  
  }).voice(function (info, req, res, next) {
    console.log(info);
    res.reply(serverConfig.notSupport);
  }).video(function (info, req, res, next) {
    console.log(info);
    res.reply(serverConfig.notSupport);
  }).location(function (info, req, res, next) {
    console.log(info);
    res.reply(serverConfig.notSupport);
  }).link(function (info, req, res, next) {
    console.log(info);
    res.reply(serverConfig.notSupport);
  }).event(function (info, req, res, next) {
    console.log("event: " + info.Event);
    if (info.Event === "subscribe"){
      res.reply(serverConfig.subscribeMesg);
    } else if (info.Event === "unsubscribe"){
      deleteUserDataToMongooseDB(info.FromUserName);
      var index = 0;
      var found = false;
      if (userData != null){
        for(var i = 0; i < userData.user.length; i++) {
          if (userData.user[i].id == info.FromUserName) {
            found = true;
            index = i;
            console.log("delete user: " + userData.user[i].id + " " + userData.user[i].name + " " + userData.user[i].package);
            break;
          }
        }
        if (found){
          userData.user.splice(index, 1);
          writeUserJsonFile();
        }
      }


    } else {
      res.reply(serverConfig.notSupport);
    }
  }).shortvideo(function (info, req, res, next) {
    console.log(info);
    res.reply(serverConfig.notSupport);
  })
));

// Start server and log
app.listen(app.get('port'), function() {
  console.log('running on port', app.get('port'))
  if ((ngrokConfig.ngrokToken != "")&&(ngrokConfig.ngrokUrl === "")){
    connectNgrok()
  }
})
