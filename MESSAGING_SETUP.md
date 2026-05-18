# Real-Time Messaging System Setup

## Overview
This document describes the fully implemented WebSocket-based real-time messaging system that allows students and recruiters to communicate securely in real-time.

## Architecture

### Database Collections

**dm_threads** - Conversation rooms
```json
{
  "_id": ObjectId,
  "thread_id": "user1_user2",  // Sorted user IDs joined with "_"
  "participants": ["user1_id", "user2_id"],
  "created_at": datetime,
  "updated_at": datetime
}
```

**dm_messages** - Individual messages
```json
{
  "_id": ObjectId,
  "thread_id": "user1_user2",
  "sender_id": "sender_user_id",
  "sender_name": "Sender Name",
  "text": "Message content",
  "read": false,  // Read receipt
  "created_at": datetime
}
```

## Backend Implementation

### WebSocket Endpoint: `/ws/{user_id}`
Located in [backend/app.py](backend/app.py#L2699)

**Authentication:**
- Query parameter: `token` (JWT token)
- Validates token matches user_id
- Rejects connection if authentication fails

**Real-Time Message Types:**

#### 1. **message** - Send a message
```javascript
{
  "type": "message",
  "thread_id": "user1_user2",
  "text": "Hello world"
}
```
- Validates thread_id and participants
- Saves message to MongoDB
- Updates thread's updated_at timestamp
- Sends message to recipient in real-time
- Returns delivery confirmation to sender

#### 2. **typing** - Send typing indicator
```javascript
{
  "type": "typing",
  "thread_id": "user1_user2",
  "recipient_id": "other_user_id"
}
```
- Notifies recipient that user is typing
- No persistence, real-time only

#### 3. **read** - Mark messages as read
```javascript
{
  "type": "read",
  "thread_id": "user1_user2"
}
```
- Marks all unread messages from other user as read
- Sends read receipt to other user
- Enables read status indicators

### REST API Endpoints

#### GET `/dm/threads`
- Lists all conversation threads for authenticated user
- Includes last message and other user info
- Sorted by most recent activity

#### POST `/dm/threads`
- Creates or retrieves existing thread with another user
- Request: `{ "recipient_id": "user_id" }`
- Prevents self-messaging
- Thread ID is deterministic (sorted user IDs)

#### POST `/dm/threads/{thread_id}/messages`
- REST fallback for sending messages (if WebSocket unavailable)
- Request: `{ "text": "message content" }`

#### GET `/dm/threads/{thread_id}/messages`
- Retrieves message history (paginated)
- Query params: `page`, `limit` (default: page=1, limit=50)
- Validates user is participant

## Frontend Implementation

### MessagingSection Component
Located in [frontend/src/pages/MessagingSection.jsx](frontend/src/pages/MessagingSection.jsx)

**WebSocket Management:**
- Automatic connection on component mount
- Auto-reconnect with 3-second delay if disconnected
- Clean disconnect on unmount

**Key Features:**

1. **Real-Time Message Delivery**
   - Messages appear instantly via WebSocket
   - REST fallback if WebSocket unavailable
   - Automatic thread refresh after sending

2. **User Search**
   - Search users by name or @handle
   - Filter: students and recruiters
   - Quick-start DM with search results

3. **Typing Indicators**
   - Sends "is typing" signal while user types
   - Shows "is typing..." label in chat
   - Auto-clears after 3 seconds of inactivity

4. **Read Receipts**
   - Single ✓ = message sent
   - Double ✓✓ = message read by recipient
   - Color-coded for clarity (brown for read)

5. **Connection Status**
   - Green indicator (🟢) when connected
   - Yellow indicator (🟡) when reconnecting
   - Real-time display at bottom of message area

6. **Thread Management**
   - Search and start new conversations
   - View all ongoing threads
   - Quick access to last message preview
   - Distinguishes recruiters with badge

## How to Use

### Starting a Conversation
1. Go to Messages tab
2. Enter name or @handle in search box
3. Click user to start thread
4. Type and send message

### Message Flow
1. **Student/Recruiter A** types message
2. **WebSocket sends** message to backend
3. **Backend validates** and saves to MongoDB
4. **Backend broadcasts** to recipient via WebSocket
5. **Recipient receives** in real-time
6. **System sends** read receipt when viewed
7. **Sender sees** double check ✓✓

### Message Persistence
- All messages stored in MongoDB `dm_messages` collection
- Indexed by thread_id and created_at for fast retrieval
- Full conversation history available on reload

## Security Features

✅ **JWT Authentication** - Only authenticated users can connect  
✅ **Participant Validation** - Users can only message users they have threads with  
✅ **Encryption** - HTTPS/WSS in production (configure in frontend env)  
✅ **Input Validation** - Text content validated and trimmed  
✅ **Self-Messaging Prevention** - Cannot start thread with self  

## Testing Checklist

- [ ] Two browsers: Student (abd90@gmail.com) and Recruiter logged in
- [ ] Student searches for recruiter by name
- [ ] Start new thread from search results
- [ ] Type and send message from Student → appears instantly for Recruiter
- [ ] Recruiter replies → appears instantly for Student
- [ ] Observe typing indicators while typing
- [ ] Observe read receipts (✓ → ✓✓)
- [ ] Reload page → conversation history persists
- [ ] Refresh thread list → last message updated
- [ ] Check MongoDB: verify dm_threads and dm_messages collections

## Environment Configuration

**Backend (.env):**
```
MONGO_URI=mongodb+srv://...  # Write connection
MONGO_URI_READ=mongodb+srv://...  # Read connection
JWT_SECRET=your_secret_key
```

**Frontend (.env.local):**
```
VITE_API_BASE=http://localhost:8000
```

## API Response Examples

### Get Threads Response
```json
[
  {
    "_id": "thread_mongo_id",
    "thread_id": "user1_user2",
    "participants": ["user1_id", "user2_id"],
    "created_at": "2026-05-13T10:00:00Z",
    "updated_at": "2026-05-13T14:30:00Z",
    "last_message": {
      "_id": "msg_id",
      "sender_id": "user1_id",
      "sender_name": "Ahmed",
      "text": "Last message preview",
      "read": true,
      "created_at": "2026-05-13T14:30:00Z"
    },
    "other_user": {
      "_id": "user2_id",
      "name": "John Recruiter",
      "handle": "john_rec",
      "avatar": null,
      "user_type": "recruiter"
    }
  }
]
```

### WebSocket Message Received
```json
{
  "type": "message",
  "thread_id": "user1_user2",
  "sender_id": "user1_id",
  "sender_name": "Ahmed",
  "text": "Hello!",
  "read": false,
  "created_at": "2026-05-13T14:35:00Z",
  "_id": "msg_id"
}
```

## Troubleshooting

**WebSocket connection fails:**
- Check JWT_SECRET is set in .env
- Verify token is valid and not expired
- Check CORS settings include WebSocket origin
- Ensure backend is running on correct port

**Messages not appearing:**
- Check browser console for WebSocket errors
- Verify thread_id is correct format (sorted user IDs)
- Check both users are participants of thread
- Try REST API fallback if WebSocket unavailable

**Read receipts not working:**
- Ensure both users have active connections
- Check read message type is being sent
- Verify MongoDB dm_messages collection is being updated

## Next Steps

- [ ] Add encryption for messages at rest
- [ ] Implement message reactions/emojis
- [ ] Add message deletion with soft delete
- [ ] Implement typing indicator timeout optimization
- [ ] Add file sharing support
- [ ] Implement message search across threads
- [ ] Add notification system for new messages
- [ ] Implement mute/unmute threads

---

**Status:** ✅ Ready for testing  
**Last Updated:** May 13, 2026  
**Tested With:** abdulrahman@gmail.com → Recruiter accounts
