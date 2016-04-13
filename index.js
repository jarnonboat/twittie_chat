/*
//  index.js
//  Twittie Chat
//
//  Created by Boat on 13/04/15.
*/

var express = require("express");
var mongoose = require('mongoose');
var assert = require("assert");
var favicon = require('serve-favicon');
var autoIncrement = require('mongoose-auto-increment');
var functions = require("./public/js/functions.js");

var url = 'mongodb://localhost:27017/chat';
var Schema = mongoose.Schema;
var connection = mongoose.createConnection(url);
autoIncrement.initialize(connection);

// Defining model for mongodb
var userSchema = new Schema({
  user_id: Number,
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  created_at: Date,
  updated_at: Date
});

// Add the date before any save
userSchema.pre('save', function(next) {
  // get the current date
  var currentDate = new Date();

  // change the updated_at field to current date
  this.updated_at = currentDate;

  // if created_at doesn't exist, add to that field
  if (!this.created_at)
    this.created_at = currentDate;

  next();
});

var messageSchema = new Schema({
  message_id: Number,
  user_id: String,
  user_name: String,
  room_id: String,
  message: String,
  created_at: Date
});

// Add the date before any save
messageSchema.pre('save', function(next) {
  // get the current date
  var currentDate = new Date();

  // change the updated_at field to current date
  this.updated_at = currentDate;

  // if created_at doesn't exist, add to that field
  if (!this.created_at)
    this.created_at = currentDate;

  next();
});

var roomSchema = new Schema({
  room_id: Number,
  room_name: String,
  user: String,
  type: String,
  prev_joined_at: Date,
  joined_at: Date,
  created_at: Date
});

roomSchema.pre('save',function(next){
  var currentDate = new Date();
  if (!this.created_at)
    this.created_at = currentDate;
  next();
})

// Create User and Message schema
userSchema.plugin(autoIncrement.plugin, {
  model: 'User',
  field: 'user_id',
  startAt: 1,
  incrementBy: 1
});
messageSchema.plugin(autoIncrement.plugin, {
  model: 'Message',
  field: 'message_id',
  startAt: 1,
  incrementBy: 1
});
roomSchema.plugin(autoIncrement.plugin, {
  model: 'Room',
  field: 'room_id',
  startAt: 1,
  incrementBy: 1
});

// Create User and Message schema
var User = connection.model('User', userSchema);
var Message = connection.model('Message', messageSchema);
var Room = connection.model('Room',roomSchema);

var app = express();
var http = require('http');
var server = http.createServer(app);
var port = 3700;
var users = [];
var userSockets = [];
var rooms = [];
var mainRoom = 'expresschat';

// Setting template engine Jade
app.set('views', __dirname + '/tpl');
app.set('view engine', "jade");
app.engine('jade', require('jade').__express);

app.get("/", function(req, res){
  res.render("index");
});

// Require public folder resources
app.use(express.static(__dirname + '/public'));
app.use(favicon(__dirname + '/public/favicon.ico'));

// Pass express to socket.io
var io = require('socket.io').listen(server);

// Initiate socket to handle all connection
io.sockets.on('connection', function (socket) {
	var _clientId = socket.id;

  socket.join(mainRoom);

  if (rooms.indexOf(mainRoom) == -1) {
    rooms.push(mainRoom);
    //rooms.push('dissys')
  }

  socket.on('addroom',function(roomId,currentId){
    if(rooms.indexOf(roomId) == -1){
      rooms.push(roomId);
    }else{
      socket.emit('exception', {message: 'This room is already existed'});
    }
    socket.broadcast.emit('updateroom',rooms);
    socket.emit('updateroom',rooms);
  });

  //check user status in clicked room
  socket.on('clickroom',function(_clientUserId,roomId){
    if(roomId != mainRoom){
      console.log("Find : " + roomId + " , "+_clientUserId);
      Room.find({room_name:roomId,user:_clientUserId}).exec(function(err,massages){
        if(massages.length == 0){
          socket.emit('updateroomStatus',"leaved");
          socket.emit('updatesend','disable');
        }
        else {
          if(massages[0].type == 'joined'){
            socket.emit('updateroomStatus',"joined");
            socket.emit('updatesend','enable');
          }else if(massages[0].type == 'paused'){
            socket.emit('updateroomStatus',"paused");
            socket.emit('updatesend','disable');
          }
        }
      });
    }else{
      socket.emit('updateroomStatus',"joined");
      socket.emit('updatesend','enable');
    }
    // if(isCurrentId_in_roomId == true){
    //   socket.emit('updateroomStatus',"joined");
    //   socket.emit('updatesend','enable');
    // }else{
    //   console.log("im here");
    //   socket.emit('updateroomStatus',"leaved");
    //   socket.emit('updatesend','disable');
    // }
  });

  // Load message for rooms
  socket.on('load_message', function (_clientId,_clientUserId, roomId) {
    console.log('Loading message for room ' + roomId);
    //var rooms = roomId.split('_');
    // if (rooms.length == 2) {
    //   var room2 = rooms[1] + '_' + rooms[0];
    //   console.log('Load from ' + roomId + ' - ' + room2);
    //   Message.find().or([{ room_id: roomId }, { room_id: room2}]).sort({'created_at': 'asc'}).exec(function (err, messages) {
    //     socket.emit('display_message', _clientId, messages);
    //   });
    // } else {
    if(roomId == mainRoom){
      Message.find({ room_id: roomId }).sort({'created_at': 'asc'}).exec(function (err, messages) {
        socket.emit('display_message', _clientId, messages);
      });
    }else{
      Room.find({room_name:roomId,user:_clientUserId}).exec(function(err,data){
        if(data.length != 0){
          if(data[0].type == 'joined'){
            Message.find({ room_id: roomId,created_at:{$gte:data[0].joined_at} }).sort({'created_at': 'asc'}).exec(function (err, messages) {
              socket.emit('display_message', _clientId, messages);
            });
          }else if(data[0].type == 'paused'){
            Message.find({ room_id: roomId,created_at:{$lt:data[0].joined_at} }).sort({'created_at': 'asc'}).exec(function (err, messages) {
              socket.emit('display_message', _clientId, messages);
            });
          }
        }
      });
    }
  });

  // Trigger on send event
  socket.on('send', function (data) {
    var _clientUser = functions.findByKey(users, 'client_id', _clientId);
    var _clientUserId = _clientUser.user_id;

    var message = new Message({
      user_id: _clientUserId,
      user_name: data.username,
      room_id: data.room_id,
      message: data.message
    });
    message.save(function (err) {
      if (err != null) {
        console.log('There is an error saving data ' + err);
      }
    });
    io.sockets.in(data.room_id).emit('message', _clientUserId, _clientId, data);
  });

  socket.on('subscribe', function (_clientUserId, clientId, room_id) {
    //add this user to db

    if (room_id != mainRoom) {
      socket.join(room_id);
      console.log("user : " + _clientUserId + "has joined : " + room_id );
      socket.emit('updateroomStatus',"joined");
      if (rooms.indexOf(room_id) == -1) {
        // Create private chat between this socket and client
        //userSockets[clientId].join(room_id);
        rooms.push(room_id);
      }
      var currentDate = new Date();
      //add to db;
      var newroom = new Room({
        room_name: room_id,
        user: _clientUserId,
        type: "joined",
        prev_joined_at: currentDate,
        joined_at: currentDate
      });

      newroom.save(function(err){
        if(err != null){
          console.log('There is an error creating room' + err);
        }
      });

      console.log(rooms);
    }

    // Create message content to hold between these two users
    io.sockets.in(room_id).emit('subscribe', _clientId, room_id);
  });

  socket.on('pause',function(_clientUserId, clientId, room_id){
    //add user pause to db & condtion display msg
    if (room_id != mainRoom) {

      console.log("user : " + _clientUserId + "has paused : " + room_id );
      socket.emit('updateroomStatus',"paused");

      var currentDate = new Date();
      //add to db;
      Room.find({room_name:room_id,user:_clientUserId,type:"joined"},function(err,data){
        Room.update({room_name: room_id,user:_clientUserId,type:"joined"}, {
            type : "paused",
            prev_joined_at: data[0].joined_at,
            joined_at: currentDate
        }, function(err, numberAffected, rawResponse) {
          if(err != null){
            console.log('There is an error creating room' + err);
          }
        });
      });

      socket.leave(room_id);
    }

    // Create message content to hold between these two users
    //io.sockets.in(room_id).emit('subscribe', _clientId, room_id);
  });

  socket.on('resume',function(_clientUserId, clientId, room_id){
    if (room_id != mainRoom) {
      console.log("user : " + _clientUserId + "has resumed to : " + room_id );
      socket.emit('updateroomStatus',"joined");

      var currentDate = new Date();
      //add to db;
      Room.find({room_name:room_id,user:_clientUserId,type:"paused"},function(err,data){
          Room.update({room_name: room_id,user:_clientUserId,type:"paused"}, {
              type : "joined",
              joined_at: data[0].prev_joined_at,
              prev_joined_at: currentDate
          }, function(err, numberAffected, rawResponse) {
            if(err != null){
              console.log('There is an error resumeing room' + err);
            }
          });
      });
      socket.join(room_id);
    }

    // Create message content to hold between these two users
    //io.sockets.in(room_id).emit('subscribe', _clientId, room_id);
  });
  socket.on('unsubscribe',function(_clientUserId,clientId,room_id){
    //delete this user from this room in db
    socket.leave(room_id);
    socket.emit('updateroomStatus',"leaved");
    Room.remove({room_name:room_id,user:_clientUserId,type:"joined"}).exec(function(err,messages){
    });
    console.log("user : " + _clientUserId +' has left room :'+room_id);
  });

  // Listen for regist action
  socket.on('regist', function (data) {
    User.findOne({ username: data.username }, function (err, user) {
      if (user == null) {
        var newUser = new User({
          username: data.username,
          password: data.password
        });

        // Save user to database
        newUser.save(function (err) {
          console.log(err);

          if (err == null) {
            // Make this user online
            User.findOne({ username: data.username }, function (err, user) {
              console.log('User ' + user.username + ' is online');

              users.push({"client_id" : _clientId, "user_name" : data.username, "user_id": user.user_id});

              userSockets[_clientId] = socket;

              // Add new user to channel
              io.sockets.emit('show_user', user.user_id, _clientId, users,rooms);
            });
          }
        })
      } else {
        socket.emit('exception', {message: 'This user is already registered'});
      }
    });
  });

  // Login event
  socket.on('login', function (data) {
    User.findOne({ username: data.username }, function (err, user) {
      if (user == null) {
        socket.emit('exception', {message: 'This user is not exist. Please create your account !'});
      } else {
        User.findOne( { username: data.username, password: data.password }, function (err, user) {
          if (user == null) {
            socket.emit('exception', {message: 'Wrong password !'});
          } else {
            console.log('User ' + user.username + ' is online');
            // Add new user to store
            users.push({"client_id" : _clientId, "user_name" : data.username, "user_id": user.user_id});

            userSockets[_clientId] = socket;

            // Add new user to channel
            io.sockets.emit('show_user', user.user_id, _clientId, users,rooms);
          }
        });
      }
    });
  });

  // Listen for disconnect event
  socket.on('disconnect', function () {
    // Update current users online
    functions.removeObject(users, _clientId);

    // Remove user from all client channel
    io.sockets.emit('remove_user', _clientId, users);

    console.log('User ' + _clientId + ' disconnected');
  });
});

server.listen(port);
console.log('Server started on port ' + port);
