import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerUser, loginUser } from "./auth";
import { insertQuestionSchema, insertAnswerSchema, insertVoteSchema, insertPostSchema, registerSchema, loginSchema } from "@shared/schema";
import { z } from "zod";
import { generateAIResponse } from "./gemini";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'));
    }
  }
});

// Admin middleware
const isAdmin = async (req: any, res: any, next: any) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Get fresh user data to check admin status
  const currentUser = await storage.getUser(user.id);
  if (!currentUser || !currentUser.isAdmin) {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Auth middleware
  setupAuth(app);

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      const user = await registerUser(userData);
      
      // Set session
      req.session!.user = user;
      
      res.json({ user: { ...user, password: undefined } });
    } catch (error: any) {
      console.error("Error registering user:", error);
      res.status(400).json({ message: error.message || "Failed to register user" });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await loginUser(credentials);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Set session
      req.session!.user = user;
      
      res.json({ user: { ...user, password: undefined } });
    } catch (error: any) {
      console.error("Error logging in user:", error);
      res.status(400).json({ message: error.message || "Failed to login" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session!.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // GET logout route for convenience (redirects to home)
  app.get('/api/logout', (req, res) => {
    req.session!.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
      res.redirect('/');
    });
  });

  app.get('/api/auth/user', async (req, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Question routes
  app.get('/api/questions', async (req, res) => {
    try {
      const { search, tags, filter, limit, offset } = req.query;
      
      const questions = await storage.getQuestions({
        search: search as string,
        tags: tags ? (tags as string).split(',') : undefined,
        filter: filter as "newest" | "unanswered",
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.get('/api/questions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }
      
      const question = await storage.getQuestion(id);
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Increment view count
      await storage.incrementViewCount(id);

      res.json(question);
    } catch (error) {
      console.error("Error fetching question:", error);
      res.status(500).json({ message: "Failed to fetch question" });
    }
  });

  app.post('/api/questions', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      console.log('Creating question for user:', user.id);
      console.log('Request body:', req.body);
      
      const questionData = insertQuestionSchema.parse({
        ...req.body,
        authorId: user.id,
      });

      console.log('Parsed question data:', questionData);
      
      const question = await storage.createQuestion(questionData);
      console.log('Created question:', question);
      res.json(question);
    } catch (error) {
      console.error("Error creating question:", error);
      if (error instanceof z.ZodError) {
        console.log('Validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid question data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create question" });
    }
  });

  app.put('/api/questions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const existingQuestion = await storage.getQuestion(id);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      if (existingQuestion.authorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to edit this question" });
      }

      const questionData = insertQuestionSchema.partial().parse(req.body);
      const question = await storage.updateQuestion(id, questionData);
      res.json(question);
    } catch (error) {
      console.error("Error updating question:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid question data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update question" });
    }
  });

  app.delete('/api/questions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const existingQuestion = await storage.getQuestion(id);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      if (existingQuestion.authorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to delete this question" });
      }

      await storage.deleteQuestion(id);
      res.json({ message: "Question deleted successfully" });
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  // Answer routes
  app.get('/api/questions/:id/answers', async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);
      const answers = await storage.getAnswersByQuestionId(questionId);
      res.json(answers);
    } catch (error) {
      console.error("Error fetching answers:", error);
      res.status(500).json({ message: "Failed to fetch answers" });
    }
  });

  app.post('/api/questions/:id/answers', isAuthenticated, async (req: any, res) => {
    try {
      const questionId = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const answerData = insertAnswerSchema.parse({
        ...req.body,
        questionId,
        authorId: user.id,
      });

      const answer = await storage.createAnswer(answerData);

      // Create notification for question author
      const question = await storage.getQuestion(questionId);
      if (question && question.authorId !== user.id) {
        await storage.createNotification({
          userId: question.authorId,
          type: "question_answered",
          title: "New Answer",
          message: `Someone answered your question: ${question.title}`,
          questionId,
          answerId: answer.id,
        });
      }

      res.json(answer);
    } catch (error) {
      console.error("Error creating answer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid answer data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create answer" });
    }
  });

  app.put('/api/answers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const existingAnswer = await storage.getAnswersByQuestionId(0);
      const answer = existingAnswer.find(a => a.id === id);
      
      if (!answer) {
        return res.status(404).json({ message: "Answer not found" });
      }

      if (answer.authorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to edit this answer" });
      }

      const answerData = insertAnswerSchema.partial().parse(req.body);
      const updatedAnswer = await storage.updateAnswer(id, answerData);
      res.json(updatedAnswer);
    } catch (error) {
      console.error("Error updating answer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid answer data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update answer" });
    }
  });

  app.post('/api/questions/:questionId/answers/:answerId/accept', isAuthenticated, async (req: any, res) => {
    try {
      const questionId = parseInt(req.params.questionId);
      const answerId = parseInt(req.params.answerId);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      if (question.authorId !== user.id) {
        return res.status(403).json({ message: "Only the question author can accept answers" });
      }

      await storage.acceptAnswer(questionId, answerId);

      // Create notification for answer author
      const answer = question.answers.find(a => a.id === answerId);
      if (answer && answer.authorId !== user.id) {
        await storage.createNotification({
          userId: answer.authorId,
          type: "answer_accepted",
          title: "Answer Accepted",
          message: `Your answer was accepted for: ${question.title}`,
          questionId,
          answerId,
        });
      }

      res.json({ message: "Answer accepted successfully" });
    } catch (error) {
      console.error("Error accepting answer:", error);
      res.status(500).json({ message: "Failed to accept answer" });
    }
  });

  // Vote routes
  app.post('/api/votes', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { questionId, answerId, voteType } = req.body;
      
      console.log('Vote request body:', req.body);
      console.log('Parsed values:', { questionId, answerId, voteType });

      // Check if user already voted
      const existingVote = await storage.getVote(user.id, questionId, answerId);
      
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Same vote type, remove the vote
          await storage.deleteVote(existingVote.id);
          return res.json({ message: "Vote removed" });
        } else {
          // Different vote type, update the vote
          const updatedVote = await storage.updateVote(existingVote.id, voteType);
          return res.json(updatedVote);
        }
      }

      // Create new vote
      const voteData = insertVoteSchema.parse({
        userId: user.id,
        questionId: questionId || null,
        answerId: answerId || null,
        voteType,
      });

      const vote = await storage.createVote(voteData);
      res.json(vote);
    } catch (error) {
      console.error("Error creating vote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vote data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create vote" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { limit } = req.query;
      
      console.log(`[API] Fetching notifications for user:`, user);
      console.log(`[API] User ID type: ${typeof user.id}, value: ${user.id}`);
      
      const notifications = await storage.getNotifications(
        user.id,
        limit ? parseInt(limit as string) : undefined
      );

      console.log(`[API] Found ${notifications.length} notifications for user ${user.id}`);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get('/api/notifications/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.put('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.markNotificationAsRead(id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put('/api/notifications/mark-all-read', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      await storage.markAllNotificationsAsRead(user.id);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Post routes
  app.get('/api/posts', isAuthenticated, async (req: any, res) => {
    try {
      const { search, tags, limit, offset } = req.query;
      const posts = await storage.getPosts({
        search: search as string,
        tags: tags ? (tags as string).split(',') : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.get('/api/posts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getPost(id);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.json(post);
    } catch (error) {
      console.error("Error fetching post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  app.post('/api/posts', isAuthenticated, upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ]), async (req: any, res) => {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Parse tags from JSON string
      let tags = [];
      if (req.body.tags) {
        try {
          tags = JSON.parse(req.body.tags);
        } catch (e) {
          tags = [];
        }
      }
      
      // Process uploaded files
      const imageUrls: string[] = [];
      const videoUrls: string[] = [];
      
      if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        if (files.images) {
          files.images.forEach(file => {
            imageUrls.push(`/uploads/${file.filename}`);
          });
        }
        
        if (files.videos) {
          files.videos.forEach(file => {
            videoUrls.push(`/uploads/${file.filename}`);
          });
        }
      }
      
      const postData = insertPostSchema.parse({
        title: req.body.title,
        content: req.body.content,
        codeSnippet: req.body.codeSnippet || null,
        language: req.body.language || null,
        tags,
        imageUrls,
        videoUrls,
        authorId: user.id,
      });
      
      const newPost = await storage.createPost(postData);
      res.json(newPost);
    } catch (error) {
      console.error("Error creating post:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid post data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.put('/api/posts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.authorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to edit this post" });
      }

      const postData = insertPostSchema.partial().parse(req.body);
      const updatedPost = await storage.updatePost(id, postData);
      res.json(updatedPost);
    } catch (error) {
      console.error("Error updating post:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid post data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update post" });
    }
  });

  app.delete('/api/posts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.authorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to delete this post" });
      }

      await storage.deletePost(id);
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  app.post('/api/posts/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const isLiked = await storage.isPostLikedByUser(postId, user.id);
      
      if (isLiked) {
        await storage.unlikePost(postId, user.id);
        res.json({ message: "Post unliked", liked: false });
      } else {
        await storage.likePost(postId, user.id);
        res.json({ message: "Post liked", liked: true });
      }
    } catch (error) {
      console.error("Error toggling post like:", error);
      res.status(500).json({ message: "Failed to toggle post like" });
    }
  });

  app.get('/api/posts/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ message: "Failed to fetch post comments" });
    }
  });

  app.post('/api/posts/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: "Comment content is required" });
      }

      const comment = await storage.createPostComment({
        postId,
        authorId: user.id,
        content,
      });
      
      res.json(comment);
    } catch (error) {
      console.error("Error creating post comment:", error);
      res.status(500).json({ message: "Failed to create post comment" });
    }
  });

  // AI Chatbot routes
  app.post('/api/ai/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      if (message.length > 2000) {
        return res.status(400).json({ message: "Message too long. Please keep it under 2000 characters." });
      }

      console.log("Processing AI chat request:", message.substring(0, 100) + "...");
      const aiResponse = await generateAIResponse(message);
      console.log("AI response generated successfully");
      
      res.json({ response: aiResponse });
    } catch (error: any) {
      console.error("Error in AI chat endpoint:", error);
      
      // Send the specific error message from the generateAIResponse function
      const errorMessage = error.message || "Failed to generate AI response";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Admin routes
  app.get('/api/admin/analytics', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { search, page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const users = await storage.getAllUsers({
        search: search as string,
        limit: parseInt(limit as string),
        offset,
      });
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.session?.user;
      const updateData = req.body;
      
      // Prevent admin from removing their own admin status
      if (userId === currentUser.id && updateData.isAdmin === false) {
        return res.status(400).json({ message: "Cannot remove admin status from yourself" });
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Log admin action
      await storage.createAdminLog({
        adminId: currentUser.id,
        action: 'update_user',
        targetType: 'user',
        targetId: userId.toString(),
        details: `Updated user: ${JSON.stringify(updateData)}`,
      });
      
      res.json({ ...updatedUser, password: undefined });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.session?.user;
      
      // Prevent admin from deleting themselves
      if (userId === currentUser.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      
      await storage.deleteUser(userId);
      
      // Log admin action
      await storage.createAdminLog({
        adminId: currentUser.id,
        action: 'delete_user',
        targetType: 'user',
        targetId: userId.toString(),
        details: `Deleted user with ID: ${userId}`,
      });
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post('/api/admin/users/:id/make-admin', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.session?.user;
      
      await storage.makeUserAdmin(userId);
      
      // Log admin action
      await storage.createAdminLog({
        adminId: currentUser.id,
        action: 'make_admin',
        targetType: 'user',
        targetId: userId.toString(),
        details: `Granted admin privileges to user ID: ${userId}`,
      });
      
      res.json({ message: "User granted admin privileges" });
    } catch (error) {
      console.error("Error making user admin:", error);
      res.status(500).json({ message: "Failed to grant admin privileges" });
    }
  });

  app.post('/api/admin/users/:id/remove-admin', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.session?.user;
      
      // Prevent admin from removing their own admin status
      if (userId === currentUser.id) {
        return res.status(400).json({ message: "Cannot remove admin status from yourself" });
      }
      
      await storage.removeUserAdmin(userId);
      
      // Log admin action
      await storage.createAdminLog({
        adminId: currentUser.id,
        action: 'remove_admin',
        targetType: 'user',
        targetId: userId.toString(),
        details: `Removed admin privileges from user ID: ${userId}`,
      });
      
      res.json({ message: "Admin privileges removed from user" });
    } catch (error) {
      console.error("Error removing admin privileges:", error);
      res.status(500).json({ message: "Failed to remove admin privileges" });
    }
  });

  app.get('/api/admin/logs', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { adminId, page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const logs = await storage.getAdminLogs({
        adminId: adminId ? parseInt(adminId as string) : undefined,
        limit: parseInt(limit as string),
        offset,
      });
      res.json(logs);
    } catch (error) {
      console.error("Error fetching admin logs:", error);
      res.status(500).json({ message: "Failed to fetch admin logs" });
    }
  });

  app.delete('/api/admin/questions/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const questionId = parseInt(req.params.id);
      const currentUser = req.session?.user;
      
      await storage.deleteQuestion(questionId);
      
      // Log admin action
      await storage.createAdminLog({
        adminId: currentUser.id,
        action: 'delete_question',
        targetType: 'question',
        targetId: questionId.toString(),
        details: `Deleted question with ID: ${questionId}`,
      });
      
      res.json({ message: "Question deleted successfully" });
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  app.delete('/api/admin/answers/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const answerId = parseInt(req.params.id);
      const currentUser = req.session?.user;
      
      await storage.deleteAnswer(answerId);
      
      // Log admin action
      await storage.createAdminLog({
        adminId: currentUser.id,
        action: 'delete_answer',
        targetType: 'answer',
        targetId: answerId.toString(),
        details: `Deleted answer with ID: ${answerId}`,
      });
      
      res.json({ message: "Answer deleted successfully" });
    } catch (error) {
      console.error("Error deleting answer:", error);
      res.status(500).json({ message: "Failed to delete answer" });
    }
  });

  app.delete('/api/admin/posts/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const currentUser = req.session?.user;
      
      await storage.deletePost(postId);
      
      // Log admin action
      await storage.createAdminLog({
        adminId: currentUser.id,
        action: 'delete_post',
        targetType: 'post',
        targetId: postId.toString(),
        details: `Deleted post with ID: ${postId}`,
      });
      
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
