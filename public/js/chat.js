/**
* TODO: Stream simple music between clients
*/

// SERVER address and port
var SERVER = 'http://localhost:3700';

var MAIN_ROOM = 'expresschat';

// Chat window is current window
var chatWindow = window.self;

$(window).load(function() {

  // Add regular expression to check username valid
  $.validator.addMethod("regex", function(value, element, regexpr) {
    return regexpr.test(value);
  }, "Please enter a valid username.");

  // Current user name
  var _username = null;

  // Current user_id
  var _userId = null;

  // socket of current connection
  var socket = io.connect(SERVER);

  // Field of message
  var field = $("#message");

  // Current client_id
  var clientId = null;

  // All users connected
  var users = [];

  // Current room_id. Default is MAIN_ROOM
  var currRoomId = MAIN_ROOM;

  // First register user
  var loginDialog = new BootstrapDialog.show({
    title: 'Login',
    closable: false,
    message: '<form id="login_form">Login ID: <input type="text" name="username" class="form-control" id="username"><br>Login Password: <input type="password" name="password" class="form-control" id="password"></form>',
    onshown: function(dialogRef) {
      $('#username').focus();
    },
    onhidden: function(dialogRef){
      $('#message').focus();
    },
    buttons: [
    {
      label: 'Sign In',
      cssClass: 'btn-primary',
      action: function(dialogRef) {
        $('#login_form').validate({
          debug: true,
          rules: {
            username: {
              required: true,
              regex: /^\S+$/ // Check has no whitespace
            },
            password: "required"
          }
        });

        var username = $('#username').val();
        var password = $('#password').val();

        if ($('#login_form').valid()) {
          _username = username;
          // Login user
          socket.emit('login', { username: username, password: password });
          $('body').after('<div id="active_room" style="display:none;">' + MAIN_ROOM + '</div>');
          $('#profile').text(username);
        }
      }
    },
    {
      label: 'Create Account',
      action: function(dialogRef) {
        $('#login_form').validate({
          debug: true,
          rules: {
            username: {
              required: true,
                regex: /^\S+$/ // Check has no whitespace
            },
            password: "required"
          }
        });

        var username = $('#username').val();
        var password = $('#password').val();

        if ($('#login_form').valid()) {
          _username = username;
          // Register user
          socket.emit('regist', { username: username, password: password });
          $('body').after('<div id="active_room" style="display:none;">' + MAIN_ROOM + '</div>');
          $('#profile').text(username);
        }
      }
    }
    ]
  });

  // On exception, show alert dialog and reset username
  socket.on('exception', function (data) {
    _username = null;

    alert(data.message);
  });

  /** Trigger message event
  * _clientUserId id of user on server database
  * _clientId id of current user socket
  * data hold message data
  */
  socket.on('message', function (_clientUserId, _clientId, data) {
    console.log('Message on room ' + data.room_id);
    //console.log(currRoomId);
    var room_id = data.room_id;

    //var tempRoom = room_id.split('_');
    //var tempRoomId = tempRoom.length == 2 ? tempRoom[1] + '_' + tempRoom[0] : '';

    if(data.message) {
      //console.log(data.message);
      var cls = 'row';
      // Handle on destination client
      if (_clientId != clientId) {
        cls = 'row_other';
      //  notifyMe(data);
        // if not current room show unread แทน
        // If not is MAIN_ROOM, show unread count message
        // if(currRoomId != room_id){
        //   var currUnread = $('#user-list li#'+room_id+' .unread').text();
        //   currUnread++;
        //   $('#user-list li#'+room_id+' .unread').text(currUnread).show();
        // }

        if (room_id == MAIN_ROOM) {
          if (currRoomId != MAIN_ROOM) {
            var currUnread = $('#user-list li#main_room .unread').text();
            currUnread++;
            $('#user-list li#main_room .unread').text(currUnread).show();
          }
        } else if (currRoomId != room_id) {
          // Show unread count message on private chat
          var currUnread = $('#user-list li#'+room_id+'_1 .unread').text();
          currUnread++;
          $('#user-list li#'+room_id+'_1 .unread').text(currUnread).show();
       }
      }

      if (currRoomId == room_id) {
        //console.log(room_id,currRoomId);
        // Show message on screen
        var date = new Date();
        var html = '<div class="' + cls + '">' +
        '<div class="r-message"><div class="username">' + data.username + '</div><div class="message">' + data.message + '</div>' +
        '<div class="profile"><img src="/images/profile.jpg" class="img-rounded"></div></div>' +
        '<div class="date">' + date.getHours() + ':' + ('0' + date.getMinutes()).slice(-2) + '</div>' +
        '</div>';
        $('#conversation').append(html).scrollTop($('#conversation')[0].scrollHeight);
      }
    } else {
      console.log("There is a problem:", data);
    }
  });

  /** Show user after logged in successfully
  * _clientUserId id of user on server database
  * _clientId id of current user socket
  * _users array of all connected users
  */
  socket.on('show_user', function (_clientUserId, _clientId, _users,_rooms) {
    // Set clientId for the first time
    if (!clientId) {
      clientId = _clientId;
      _userId = _clientUserId;
    }

    // Close login dialog
    loginDialog.close();
    $('#user-list').empty();
    // Main chat room
    if (!$('#main_room').is(':visible')) {
      var html = '<li class="row-user active" id="main_room" data-rid="' + MAIN_ROOM + '"><span class="user_name">Main Room</span><span class="unread">0</span></li>';
      $('#user-list').append(html);
    }
    users = _users;
    $.each(_rooms, function(key, value){
      if(value != MAIN_ROOM){
        var html = '<li class="row-user" id="'+value+'_1" data-rid="' + value + '"><span class="user_name">'+value+'</span><span class="unread">0</span></li>';
        $('#user-list').append(html);
      }
    });

    // Show all users. If new users connected, only show that user
    // for (key in users) {
    //   var user = users[key];
    //
    //   var cId = user.client_id;
    //   var userId = user.user_id;
    //   var username = user.user_name;
    //
    //   if (_username == username) {
    //     continue;
    //   }
    //
    //   // If this user is not shown, show it
    //   if (!$('#' + cId).is(':visible')) {
    //     var html = '<li class="row-user" id="' + cId + '" data-rid="' + userId + '"><img src="/images/profile.jpg" class="img-circle"><span class="user_name">' + username + '</span><span class="unread">0</span></li>';
    //
    //     $('#user-list').append(html);
    //   }
    // }
    // Display message history
    $('#joinroom').hide();
    $('#leaveroom').hide();
    socket.emit('load_message', _clientId,_userId, MAIN_ROOM);
  });

  socket.on('updateroom',function(_rooms){
    console.log("New Room added : " + _rooms);
    $('#user-list').empty();
		$.each(_rooms, function(key, value) {
			if(value == MAIN_ROOM){
        var html = '<li class="row-user" id="main_room" data-rid="' + MAIN_ROOM + '"><span class="user_name">Main Room</span><span class="unread">0</span></li>';
        $('#user-list').append(html);
			}
			else {
        var html = '<li class="row-user" id="'+value+'_1" data-rid="' + value + '"><span class="user_name">'+value+'</span><span class="unread">0</span></li>';
        $('#user-list').append(html);
			}
		});
    $('#user-list li[data-rid=' + currRoomId + ']').addClass('active');

  });

  socket.on('updatesend',function(btnstatus){
    console.log('button update!!');
    if(btnstatus == 'disable'){
      $('#send').prop('disabled', true);
      $('#message').prop('disabled', true);
    }
    else {
      $('#send').prop('disabled', false);
      $('#message').prop('disabled', false);
    }
  });

  socket.on('updateroomStatus',function(status){
    if(currRoomId == MAIN_ROOM){
      $('#joinroom').hide();
      $('#leaveroom').hide();
    }else{
      //console.log('Im back');
        switch (status) {
        case "joined":
            $('#joinroom').hide();
            $('#leaveroom').show();
            console.log("joined");
            break;
        case "leaved":
            $('#leaveroom').hide();
            $('#joinroom').show();
            console.log("leaved");
            break;
        case "paused":
            $('#joinroom').show();
            $('#leaveroom').show();
            console.log("paused");
            break;
        }
    }
  });
  /**
  * _clientId id of current user socket
  * room_id room_id that user want to connect to
  */
  socket.on('subscribe', function (_clientId, room_id) {
    // Show messages of this room
    if (_clientId == clientId) {
      currRoomId = room_id;

      console.log('Subscribe Room ' + currRoomId);
      // Load messages for this room
      socket.emit('load_message', _clientId,_userId, currRoomId);
      $('#active_room').text(currRoomId);
    }
  });

  // Remove users from data
  socket.on('remove_user', function (_clientId, _users) {
    users = _users;

      // Remove from channel
      $('#' + _clientId).remove();
    });

  socket.on('display_message', function (_clientId, messages) {
    $('#conversation').html('');

    for (key in messages) {
      var message = messages[key];
      var user_id = message.user_id;

      var cls = 'row';
      if (_userId != user_id) {
        cls = 'row_other';
      }

      // Show message on screen
      var date = new Date(message.created_at);
      var today = new Date();
      var dateString = '';
      if (date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear()) {
        // Show only hour and minute
        dateString = date.getHours() + ':' + ('0' + date.getMinutes()).slice(-2);
      } else {
        if (date.getFullYear() == today.getFullYear()) {
          dateString = (date.getMonth()+1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + ('0' + date.getMinutes()).slice(-2);
        } else {
          dateString = date.getFullYear() + '/' + (date.getMonth()+1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + ('0' + date.getMinutes()).slice(-2);
        }
      }
      var html = '<div class="' + cls + '">' +
      '<div class="r-message"><div class="username">' + message.user_name + '</div><div class="message">' + message.message + '</div>' +
      '<div class="profile"><img src="/images/profile.jpg" class="img-rounded"></div></div>' +
      '<div class="date">' + dateString + '</div>' +
      '</div>';
      $('#conversation').append(html).scrollTop($('#conversation')[0].scrollHeight);
    }
  });

  /**
  * User interaction. Active private chat for user clicked
  */

  var click_roomId;
  var click_clientId;
  $('#user').on('click', '.row-user', function () {
    // Hide unread notify
    $(this).find('.unread').text('').hide();
    $('#conversation').empty();
    click_roomId = $(this).attr('data-rid');
    click_clientId = $(this).attr('id'); // Client ID of the socket connected
    var roomTitle = $(this).find('.user_name').text();
    //console.log(roomId,_clientId,roomTitle);
    $('.room-title').text(roomTitle);

    $('#user-list li').removeClass('active');

    $('#user-list li[data-rid=' + click_roomId + ']').addClass('active');

    socket.emit('clickroom',_userId,click_roomId);

    var activeRoom = click_roomId;
    currRoomId = activeRoom;

    socket.emit('load_message',click_clientId,_userId,click_roomId);

    // if ($('#' + activeRoom).length == 0) {
    //   currRoomId = activeRoom;
    //     // Change room for private chat
    // //    socket.emit('subscribe', _userId, _clientId, roomId);
    // } else {
    //   // Only active current private chat
    //   currRoomId = activeRoom;
    //
    //   // Load messages for this room
    // //  socket.emit('load_message', _clientId, currRoomId);
    //   $('#active_room').text(currRoomId);
    // }
     $('#message').focus();
  });

  $('#newroom').click(function(){
    var roomname = $('#newroomname').val().trim();
    //console.log(roomname);
    if(roomname != ''){
      socket.emit('addroom',roomname,_username);
      $('#newroomname').val('');
    }else{
      alert('Please enter room name');
    }
  });

  $('#joinroom').click(function(){
    //$('#joinroom').hide();
    $('#send').prop('disabled', false);
    $('#message').prop('disabled', false);
    socket.emit('subscribe', _userId, click_clientId, click_roomId);
    $('#message').focus();
  });

  $('#leaveroom').click(function(){
    $('#send').prop('disabled', true);
    $('#message').prop('disabled', true);
    $('#conversation').empty();
    socket.emit('unsubscribe',_userId,click_clientId,click_roomId);
  });
  // User click Send button
  $('#send').click(function() {
    var text = field.val().trim();

    if (text !== '') {
      socket.emit('send', { message: text, username: _username, room_id: currRoomId });

      field.val('').focus();
    }
  });

  // Catch when user press Enter on keyboard
  $('#message').keypress(function(e) {
    var text = field.val().trim();

    if (e.which == 13 && text !== '') {
      socket.emit('send', { message: text, username: _username, room_id: currRoomId });

      console.log('Send message in room ' + currRoomId);

      $(this).val('').focus();
    }
  });
});


// Show desktop notification
// $(function() {
//   // request permission on page load
//   if (Notification.permission !== "granted")
//     Notification.requestPermission();
// });
//
// function notifyMe(data) {
//   if (!Notification) {
//     alert('Desktop notifications not available in your browser. Try Chromium.');
//     return;
//   }
//
//   if (Notification.permission !== "granted")
//     Notification.requestPermission();
//   else {
//     var notification = new Notification('New message', {
//       icon: SERVER + '/images/so_icon.png',
//       body: data.message,
//     });
//
//     // Open and active current chat window
//     notification.onclick = function () {
//       chatWindow.focus();
//     };
//   }
// }
