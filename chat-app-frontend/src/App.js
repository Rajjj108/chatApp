import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const ChatApp = () => {
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate random room code
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Connect to chat room
  const joinRoom = () => {
    if (!roomCode.trim() || !username.trim()) return;

    setIsJoining(true);
    
    // Connect to socket server (replace with your backend URL)
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket']
    });

    newSocket.emit('join-room', { roomCode: roomCode.toUpperCase(), username });

    newSocket.on('room-joined', ({ users }) => {
      setIsConnected(true);
      setIsJoining(false);
      setConnectedUsers(users);
      setMessages([]);
    });

    newSocket.on('room-full', () => {
      alert('Room is full! Maximum 2 users allowed.');
      setIsJoining(false);
      newSocket.disconnect();
    });

    newSocket.on('user-joined', ({ username: joinedUser, users }) => {
      setConnectedUsers(users);
      setMessages(prev => [...prev, {
        type: 'system',
        text: `${joinedUser} joined the chat`,
        timestamp: new Date()
      }]);
    });

    newSocket.on('user-left', ({ username: leftUser, users }) => {
      setConnectedUsers(users);
      setMessages(prev => [...prev, {
        type: 'system',
        text: `${leftUser} left the chat`,
        timestamp: new Date()
      }]);
    });

    newSocket.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setConnectedUsers(0);
    });

    setSocket(newSocket);
  };

  // Send text message
  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    const message = {
      type: 'text',
      text: newMessage,
      username,
      timestamp: new Date()
    };

    socket.emit('send-message', message);
    setMessages(prev => [...prev, { ...message, own: true }]);
    setNewMessage('');
  };

  // Handle image selection and send
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !socket) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('Image too large! Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const message = {
        type: 'image',
        imageData: event.target.result,
        username,
        timestamp: new Date()
      };

      socket.emit('send-message', message);
      setMessages(prev => [...prev, { ...message, own: true }]);
    };
    reader.readAsDataURL(file);
  };

  // Leave room
  const leaveRoom = () => {
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setIsConnected(false);
    setRoomCode('');
    setMessages([]);
    setConnectedUsers(0);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const styles = {
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    },
    header: {
      textAlign: 'center',
      marginBottom: '20px',
      color: '#333'
    },
    title: {
      fontSize: '2rem',
      margin: '0 0 10px 0',
      color: '#2c3e50'
    },
    subtitle: {
      color: '#7f8c8d',
      margin: '0'
    },
    joinForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      maxWidth: '400px',
      margin: '0 auto',
      padding: '30px',
      border: '2px solid #ecf0f1',
      borderRadius: '10px',
      backgroundColor: '#fff'
    },
    input: {
      padding: '12px',
      fontSize: '16px',
      border: '2px solid #bdc3c7',
      borderRadius: '5px',
      outline: 'none'
    },
    inputFocus: {
      borderColor: '#3498db'
    },
    button: {
      padding: '12px 20px',
      fontSize: '16px',
      backgroundColor: '#3498db',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      transition: 'background-color 0.3s'
    },
    buttonHover: {
      backgroundColor: '#2980b9'
    },
    generateButton: {
      backgroundColor: '#27ae60',
      padding: '8px 16px',
      fontSize: '14px'
    },
    chatContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      border: '2px solid #ecf0f1',
      borderRadius: '10px',
      overflow: 'hidden',
      backgroundColor: '#fff'
    },
    chatHeader: {
      padding: '15px',
      backgroundColor: '#34495e',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    roomInfo: {
      fontSize: '18px',
      fontWeight: 'bold'
    },
    userCount: {
      fontSize: '14px',
      opacity: 0.9
    },
    messagesContainer: {
      flex: 1,
      padding: '20px',
      overflowY: 'auto',
      backgroundColor: '#f8f9fa'
    },
    message: {
      marginBottom: '15px',
      padding: '10px 15px',
      borderRadius: '15px',
      maxWidth: '70%',
      wordWrap: 'break-word'
    },
    ownMessage: {
      backgroundColor: '#3498db',
      color: 'white',
      marginLeft: 'auto',
      textAlign: 'right'
    },
    otherMessage: {
      backgroundColor: 'white',
      border: '1px solid #ecf0f1'
    },
    systemMessage: {
      textAlign: 'center',
      fontStyle: 'italic',
      color: '#7f8c8d',
      backgroundColor: 'transparent',
      margin: '10px auto'
    },
    messageHeader: {
      fontSize: '12px',
      opacity: 0.8,
      marginBottom: '5px'
    },
    messageText: {
      fontSize: '14px',
      lineHeight: '1.4'
    },
    messageImage: {
      maxWidth: '100%',
      maxHeight: '300px',
      borderRadius: '8px',
      marginTop: '5px'
    },
    inputContainer: {
      padding: '15px',
      borderTop: '1px solid #ecf0f1',
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    },
    messageInput: {
      flex: 1,
      padding: '10px',
      border: '1px solid #bdc3c7',
      borderRadius: '20px',
      outline: 'none',
      fontSize: '14px'
    },
    sendButton: {
      padding: '10px 20px',
      backgroundColor: '#27ae60',
      color: 'white',
      border: 'none',
      borderRadius: '20px',
      cursor: 'pointer',
      fontSize: '14px'
    },
    imageButton: {
      padding: '8px 12px',
      backgroundColor: '#e74c3c',
      color: 'white',
      border: 'none',
      borderRadius: '20px',
      cursor: 'pointer',
      fontSize: '14px'
    },
    leaveButton: {
      backgroundColor: '#e74c3c',
      padding: '8px 16px',
      fontSize: '14px'
    },
    hiddenInput: {
      display: 'none'
    }
  };

  if (!isConnected) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🔒 Private Chat</h1>
          <p style={styles.subtitle}>Secure, anonymous, real-time messaging</p>
        </div>

        <div style={styles.joinForm}>
          <input
            style={styles.input}
            type="text"
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
          />
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              style={{ ...styles.input, flex: 1 }}
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button
              style={{ ...styles.button, ...styles.generateButton }}
              onClick={() => setRoomCode(generateRoomCode())}
            >
              Generate
            </button>
          </div>

          <button
            style={styles.button}
            onClick={joinRoom}
            disabled={isJoining || !roomCode.trim() || !username.trim()}
          >
            {isJoining ? 'Joining...' : 'Join Chat'}
          </button>

          <p style={{ fontSize: '12px', color: '#7f8c8d', textAlign: 'center', margin: '10px 0 0 0' }}>
            Share the room code with someone to start chatting privately
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.chatContainer}>
        <div style={styles.chatHeader}>
          <div>
            <div style={styles.roomInfo}>Room: {roomCode}</div>
            <div style={styles.userCount}>
              {connectedUsers} user{connectedUsers !== 1 ? 's' : ''} connected
            </div>
          </div>
          <button
            style={{ ...styles.button, ...styles.leaveButton }}
            onClick={leaveRoom}
          >
            Leave
          </button>
        </div>

        <div style={styles.messagesContainer}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.message,
                ...(msg.type === 'system' 
                  ? styles.systemMessage 
                  : msg.own 
                    ? styles.ownMessage 
                    : styles.otherMessage
                )
              }}
            >
              {msg.type !== 'system' && (
                <div style={styles.messageHeader}>
                  {msg.own ? 'You' : msg.username} • {formatTime(msg.timestamp)}
                </div>
              )}
              
              {msg.type === 'text' && (
                <div style={styles.messageText}>{msg.text}</div>
              )}
              
              {msg.type === 'image' && (
                <img
                  src={msg.imageData}
                  alt="Shared image"
                  style={styles.messageImage}
                />
              )}
              
              {msg.type === 'system' && (
                <div style={styles.messageText}>{msg.text}</div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div style={styles.inputContainer}>
          <input
            style={styles.messageInput}
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={styles.hiddenInput}
          />
          
          <button
            style={styles.imageButton}
            onClick={() => fileInputRef.current?.click()}
          >
            📷
          </button>
          
          <button
            style={styles.sendButton}
            onClick={sendMessage}
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;