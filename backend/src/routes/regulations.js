const express = require("express");
const router = express.Router();
const { admin, db } = require("../firebase");
const { requireReviewer, requireAdmin } = require("../middleware/roles");
const { v4: uuidv4 } = require('uuid');

// Helper function to generate reference number in format [CategoryPrefix]-[Year]-[Random4Digits]
const generateRefNumber = (category = '') => {
  // Default to 'PR' if no category is provided
  const prefix = category && typeof category === 'string' && category.length >= 2 
    ? category.substring(0, 2).toUpperCase()
    : 'PR';
  
  const year = new Date().getFullYear();
  // Generate a 4-digit random number
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  
  return `${prefix}-${year}-${randomNumber}`;
};

// Simple in-memory cache with 1-minute TTL
const cache = {};
const CACHE_TTL = 60 * 1000; // 1 minute

// GET all regulations with pagination
router.get("/", async (req, res) => {
  try {
    const { status, category, limit = 10, page = 1 } = req.query;
    
    // Generate a cache key based on the request
    const cacheKey = `regulations_${status || 'all'}_${category || 'all'}_${page}_${limit}`;
    
    // Check cache first
    const now = Date.now();
    if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
      return res.json({ 
        success: true, 
        data: cache[cacheKey].data,
        fromCache: true
      });
    }

    let query = db.collection("regulations");

    // Apply filters
    if (status) query = query.where("status", "==", status);
    if (category) query = query.where("category", "==", category);

    // Get total count for pagination
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Apply pagination
    const snapshot = await query
      .orderBy("createdAt", "desc")
      .limit(Number(limit))
      .offset(Number(offset))
      .get();

    const regulations = [];
    snapshot.forEach((doc) => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    const response = {
      data: regulations,
      pagination: {
        total,
        totalPages,
        currentPage: Number(page),
        itemsPerPage: Number(limit)
      }
    };

    // Cache the response
    cache[cacheKey] = {
      data: response,
      timestamp: now
    };

    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit regulation for review (supports both PUT and POST)
router.all(["/:id/submit"], async (req, res) => {
  // Only allow PUT and POST methods
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use PUT or POST.' 
    });
  }
  try {
    const { id } = req.params;
    const regulationRef = db.collection('regulations').doc(id);
    const doc = await regulationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const prevStatus = doc.data().status;
    const actorId = req.headers['x-user-id'] || doc.data().createdBy || null;
    const now = new Date();

    const updates = {
      status: 'Pending Review',
      submittedAt: now,
      updatedAt: now,
      history: admin.firestore.FieldValue.arrayUnion({
        action: prevStatus === 'Needs Revision' ? 'resubmitted' : 'submitted',
        actorId,
        actorRole: 'employee',
        timestamp: now,
        note: prevStatus === 'Needs Revision' ? 'Regulation resubmitted after revision' : 'Regulation submitted for review'
      }),
      workflow: {
        currentStage: 'review',
        stages: {
          ...(doc.data().workflow?.stages || {}),
          review: {
            status: 'active',
            timestamp: now
          },
          draft: {
            status: 'completed',
            timestamp: now
          }
        }
      }
    };

    await regulationRef.update(updates);
    const updatedDoc = await regulationRef.get();

    // Invalidate cache
    Object.keys(cache).forEach(key => {
      if (key.startsWith('regulations_')) {
        delete cache[key];
      }
    });

    res.json({
      success: true,
      data: { id: updatedDoc.id, ...updatedDoc.data() }
    });
  } catch (error) {
    console.error('Error submitting regulation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET single regulation by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("regulations").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Regulation not found" });
    }

    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /regulations - Create a new regulation
router.post("/", async (req, res) => {
  try {
    const { 
      title, 
      category, 
      description, 
      notes, 
      deadline, 
      version = "v1.0",
      attachments = [],
      createdBy,
      code = ''
    } = req.body;

    // Validate required fields
    if (!title || !category) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and category are required' 
      });
    }

    // Generate reference number
    const refNumber = generateRefNumber(category);
    
    const now = new Date();
    // Create regulation data
    const regulationData = {
      title,
      category,
      description: description || "",
      notes: notes || "",
      deadline: deadline ? new Date(deadline) : null,
      version,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdBy,
      status: 'Draft',
      code: code || '',
      ref: refNumber,
      refNumber: refNumber,
      createdAt: now,
      updatedAt: now,
      // Progress tracker / audit history
      history: [
        {
          action: 'created',
          actorId: createdBy || null,
          actorRole: 'employee',
          timestamp: now,
          note: 'Regulation created'
        }
      ],
      workflow: {
        currentStage: 'draft',
        stages: {
          draft: {
            status: 'active',
            timestamp: now
          }
        }
      }
    };

    // Add to Firestore
    const docRef = await db.collection("regulations").add(regulationData);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Failed to retrieve created document');
    }

    // Invalidate cache
    Object.keys(cache).forEach(key => {
      if (key.startsWith('regulations_')) {
        delete cache[key];
      }
    });

    res.status(201).json({ 
      success: true, 
      data: {
        ...doc.data(),
        id: doc.id
      }
    });
  } catch (error) {
    console.error('Error creating regulation:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      regulationData: error.regulationData
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create regulation',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Test endpoint to check Firestore connection
router.get('/test-firestore', async (req, res) => {
  try {
    // Try to write a test document
    const testRef = db.collection('test_collection').doc('test_doc');
    await testRef.set({
      test: 'This is a test document',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Try to read it back
    const doc = await testRef.get();
    if (!doc.exists) {
      throw new Error('Test document was not created');
    }
    
    // Clean up
    await testRef.delete();
    
    res.json({
      success: true,
      message: 'Firestore connection is working',
      data: doc.data()
    });
  } catch (error) {
    console.error('Firestore test error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to connect to Firestore',
      details: error.message
    });
  }
});

// Debug: Log all registered routes
console.log('Available routes:');
router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(
      Object.keys(r.route.methods).map(method => method.toUpperCase()).join(', '),
      r.route.path
    );
  }
});

// UPDATE regulation by ID
router.put("/:id", async (req, res) => {
  console.log('PUT /:id route hit with params:', req.params, 'body:', req.body);
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const { __auditAction, __auditNote, ...updatesWithoutAudit } = updates;
    
    // Remove immutable fields
    const { id: _, createdAt, createdBy, refNumber, ...validUpdates } = updatesWithoutAudit;
    
    // Add updatedAt timestamp
    const now = new Date();
    validUpdates.updatedAt = now;
    
    // Convert deadline to Date object if provided as string
    if (validUpdates.deadline) {
      try {
        if (typeof validUpdates.deadline === 'string') {
          const deadlineDate = new Date(validUpdates.deadline);
          if (!isNaN(deadlineDate.getTime())) {
            validUpdates.deadline = deadlineDate;
          } else {
            // Invalid date string, set to null
            validUpdates.deadline = null;
          }
        } else if (validUpdates.deadline instanceof Date) {
          // Already a Date object, keep it
        } else {
          // Invalid format, set to null
          validUpdates.deadline = null;
        }
      } catch (e) {
        console.error('Error converting deadline:', e);
        validUpdates.deadline = null;
      }
    } else if (validUpdates.deadline === null || validUpdates.deadline === '') {
      // Explicitly set to null if empty string or null
      validUpdates.deadline = null;
    }
    
    const regulationRef = db.collection("regulations").doc(id);
    const doc = await regulationRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Regulation not found" });
    }
    
    // Check if the user is the creator (only allow updates by creator or admin)
    const regulation = doc.data();
    const actorId = req.headers['x-user-id'] || req.user?.uid || null;
    const actorRole = req.headers['x-user-role'] || req.user?.role || (regulation.createdBy === actorId ? 'employee' : 'user');
    const action = __auditAction || (regulation.status === 'Needs Revision' ? 'revised' : 'updated');
    const note = __auditNote || (action === 'revised' ? 'Regulation revised by employee' : 'Regulation updated');

    // Append to progress tracker / audit history
    validUpdates.history = admin.firestore.FieldValue.arrayUnion({
      action,
      actorId,
      actorRole,
      timestamp: now,
      note
    });

    if (req.user && req.user.role !== 'admin' && regulation.createdBy !== req.user.uid) {
      return res.status(403).json({ 
        success: false, 
        error: "Not authorized to update this regulation" 
      });
    }
    
    // Update the document
    await regulationRef.update(validUpdates);
    
    // Get the updated document
    const updatedDoc = await regulationRef.get();
    
    res.json({ 
      success: true, 
      data: { id: updatedDoc.id, ...updatedDoc.data() } 
    });
  } catch (error) {
    console.error("Error updating regulation:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE regulation by ID
router.delete("/:id", async (req, res) => {
  console.log('DELETE /:id route hit with params:', req.params);
  try {
    const { id } = req.params;
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Regulation not found' 
      });
    }

    const regulation = regulationDoc.data();
    
    // Only allow deletion of drafts (optional: you can remove this restriction)
    // Uncomment the following lines if you want to restrict deletion to drafts only
    // if (regulation.status !== 'Draft' && regulation.status !== 'draft') {
    //   return res.status(400).json({ 
    //     success: false, 
    //     error: 'Only draft regulations can be deleted' 
    //   });
    // }

    // Delete the regulation
    await regulationRef.delete();

    // Invalidate cache
    Object.keys(cache).forEach(key => {
      if (key.startsWith('regulations_')) {
        delete cache[key];
      }
    });

    res.json({ 
      success: true, 
      message: 'Regulation deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting regulation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ====================================
// REVIEWER ENDPOINTS
// ====================================

/**
 * @route POST /api/regulations/:id/review
 * @desc Submit a review for a regulation
 * @access Reviewer, Admin
 */
router.post("/:id/review", requireReviewer, async (req, res) => {
  const { id } = req.params;
  const { feedback, status } = req.body;
  const { userId } = req.user; // Assuming user is set by auth middleware

  if (!feedback || !status || !['approved', 'needs_changes'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Feedback and valid status (approved/needs_changes) are required'
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const doc = await regulationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const reviewData = {
      reviewerId: userId,
      feedback,
      status,
      reviewedAt: new Date()
    };

    // Update regulation with review
    await regulationRef.update({
      status: status === 'approved' ? 'under_review' : 'needs_revision',
      lastUpdated: new Date(),
      $push: { reviews: reviewData }
    });

    res.json({
      success: true,
      message: `Regulation ${status} successfully`,
      data: { review: reviewData }
    });
  } catch (error) {
    console.error('Review submission failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit review',
      details: error.message
    });
  }
});

// ====================================
// ADMIN ENDPOINTS
// ====================================

/**
 * @route POST /api/regulations/:id/assign-reviewer
 * @desc Assign a reviewer to a regulation
 * @access Admin
 */
router.post('/:id/assign-reviewer', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { reviewerId } = req.body;

  if (!reviewerId) {
    return res.status(400).json({
      success: false,
      error: 'Reviewer ID is required'
    });
  }

  try {
    // Verify reviewer exists and has reviewer role
    const reviewerDoc = await db.collection('users').doc(reviewerId).get();
    if (!reviewerDoc.exists || !['reviewer', 'admin'].includes(reviewerDoc.data().role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reviewer ID or user is not a reviewer'
      });
    }

    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Regulation not found'
      });
    }

    // Update regulation with assigned reviewer
    await regulationRef.update({
      assignedReviewer: reviewerId,
      status: 'under_review',
      lastUpdated: new Date()
    });

    res.json({
      success: true,
      message: 'Reviewer assigned successfully',
      data: {
        regulationId: id,
        reviewerId,
        assignedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to assign reviewer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign reviewer',
      details: error.message
    });
  }
});

/**
 * @route POST /api/regulations/:id/publish
 * @desc Publish a regulation
 * @access Admin
 */
router.post('/:id/publish', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { versionNotes } = req.body;

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Regulation not found'
      });
    }

    const regulationData = regulationDoc.data();

    // Check if regulation is ready to be published
    if (regulationData.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        error: 'Only regulations under review can be published'
      });
    }

    // Update regulation status and version
    const currentVersion = regulationData.version || 1;
    const now = new Date();

    // Remove all notes and revision deadline when publishing
    await regulationRef.update({
      status: 'published',
      version: currentVersion + 1,
      publishedAt: now,
      lastUpdated: now,
      isActive: true,
      notes: db.FieldValue.delete(), // Remove employee notes
      adminNotes: db.FieldValue.delete(), // Remove admin notes
      feedback: db.FieldValue.delete(), // Remove reviewer feedback
      reviewerFeedback: db.FieldValue.delete(), // Remove reviewer feedback
      revisionDeadline: db.FieldValue.delete(), // Remove revision deadline
      $push: {
        versionHistory: {
          version: currentVersion,
          updatedAt: now,
          notes: versionNotes || 'Initial publication',
          status: 'published'
        }
      }
    });

    res.json({
      success: true,
      message: 'Regulation published successfully',
      data: {
        regulationId: id,
        version: currentVersion + 1,
        publishedAt: now
      }
    });
  } catch (error) {
    console.error('Failed to publish regulation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish regulation',
      details: error.message
    });
  }
});

// Assign regulation to author
router.post('/:id/assign', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { authorId, dueDate } = req.body;
  
  if (!authorId || !dueDate) {
    return res.status(400).json({ 
      success: false, 
      error: 'Author ID and due date are required' 
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    // Verify author exists
    const authorDoc = await db.collection('users').doc(authorId).get();
    if (!authorDoc.exists) {
      return res.status(404).json({ success: false, error: 'Author not found' });
    }

    const updateData = {
      status: 'assigned',
      assignedTo: authorId,
      dueDate: new Date(dueDate),
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'assigned',
        by: req.user.uid,
        to: authorId,
        timestamp: new Date(),
        comment: `Assigned to ${authorDoc.data().name}`
      })
    };

    await regulationRef.update(updateData);
    
    // Notify author about the assignment
    await db.collection('notifications').add({
      type: 'regulation_assigned',
      userId: authorId,
      regulationId: id,
      message: `You have been assigned a new regulation: ${regulationDoc.data().title}`,
      read: false,
      createdAt: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Regulation assigned successfully',
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error assigning regulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit regulation for review
router.post('/:id/submit', async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const regulation = regulationDoc.data();
    
    // Check if user is the author
    if (regulation.assignedTo !== req.user.uid) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only the assigned author can submit for review' 
      });
    }

    // Check if in correct status
    if (!['draft', 'assigned', 'revision_required'].includes(regulation.status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Regulation cannot be submitted for review in its current state' 
      });
    }

    const updateData = {
      status: 'under_review',
      submittedAt: new Date(),
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'submitted_for_review',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment || 'Submitted for review'
      })
    };

    await regulationRef.update(updateData);

    // Notify reviewers
    const reviewers = await db.collection('users')
      .where('role', 'in', ['reviewer', 'admin'])
      .get();
    
    const notificationPromises = [];
    reviewers.forEach(doc => {
      notificationPromises.push(
        db.collection('notifications').add({
          type: 'review_requested',
          userId: doc.id,
          regulationId: id,
          message: `New regulation submitted for review: ${regulation.title}`,
          read: false,
          createdAt: new Date()
        })
      );
    });

    await Promise.all(notificationPromises);

    res.json({ 
      success: true, 
      message: 'Regulation submitted for review',
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error submitting regulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Review regulation (approve/reject)
router.post('/:id/review', requireReviewer, async (req, res) => {
  const { id } = req.params;
  const { action, comment } = req.body; // action: 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid action. Must be "approve" or "reject"' 
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const regulation = regulationDoc.data();
    
    // Check if in correct status
    if (regulation.status !== 'under_review') {
      return res.status(400).json({ 
        success: false, 
        error: 'Regulation is not in review' 
      });
    }

    const updateData = {
      status: action === 'approve' ? 'approved' : 'revision_required',
      reviewedAt: new Date(),
      reviewedBy: req.user.uid,
      updatedAt: new Date(),
      // Save feedback/comment to both feedback field and history
      feedback: comment || (action === 'approve' ? 'Approved by reviewer' : 'Changes requested'),
      reviewerFeedback: comment || '', // Also store in reviewerFeedback for clarity
      history: db.FieldValue.arrayUnion({
        action: action === 'approve' ? 'approved_by_reviewer' : 'rejected_by_reviewer',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment || (action === 'approve' ? 'Approved by reviewer' : 'Changes requested')
      })
    };

    await regulationRef.update(updateData);

    // Notify author
    await db.collection('notifications').add({
      type: action === 'approve' ? 'review_approved' : 'review_rejected',
      userId: regulation.assignedTo,
      regulationId: id,
      message: action === 'approve' 
        ? `Your regulation "${regulation.title}" has been approved by reviewer`
        : `Your regulation "${regulation.title}" requires changes`,
      read: false,
      createdAt: new Date(),
      comment: comment || ''
    });

    // If approved, notify admin
    if (action === 'approve') {
      const admins = await db.collection('users')
        .where('role', '==', 'admin')
        .get();
      
      const notificationPromises = [];
      admins.forEach(doc => {
        notificationPromises.push(
          db.collection('notifications').add({
            type: 'ready_for_publication',
            userId: doc.id,
            regulationId: id,
            message: `Regulation ready for publication: ${regulation.title}`,
            read: false,
            createdAt: new Date()
          })
        );
      });

      await Promise.all(notificationPromises);
    }

    res.json({ 
      success: true, 
      message: `Regulation ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error processing review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish regulation (admin only)
router.post('/:id/publish', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const regulation = regulationDoc.data();
    
    // Check if in correct status
    if (regulation.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only approved regulations can be published' 
      });
    }

    // Remove all notes and revision deadline when publishing
    const updateData = {
      status: 'published',
      publishedAt: new Date(),
      publishedBy: req.user.uid,
      updatedAt: new Date(),
      notes: db.FieldValue.delete(), // Remove employee notes
      adminNotes: db.FieldValue.delete(), // Remove admin notes
      feedback: db.FieldValue.delete(), // Remove reviewer feedback
      reviewerFeedback: db.FieldValue.delete(), // Remove reviewer feedback
      revisionDeadline: db.FieldValue.delete(), // Remove revision deadline
      history: db.FieldValue.arrayUnion({
        action: 'published',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment || 'Published by admin'
      })
    };

    await regulationRef.update(updateData);

    // Notify author and reviewers
    const notificationPromises = [
      // Notify author
      db.collection('notifications').add({
        type: 'regulation_published',
        userId: regulation.assignedTo,
        regulationId: id,
        message: `Your regulation "${regulation.title}" has been published`,
        read: false,
        createdAt: new Date(),
        comment: comment || ''
      })
    ];

    // Notify reviewers
    const reviewers = await db.collection('users')
      .where('role', 'in', ['reviewer', 'admin'])
      .get();
    
    reviewers.forEach(doc => {
      if (doc.id !== req.user.uid) { // Don't notify the admin who published
        notificationPromises.push(
          db.collection('notifications').add({
            type: 'regulation_published',
            userId: doc.id,
            regulationId: id,
            message: `Regulation "${regulation.title}" has been published`,
            read: false,
            createdAt: new Date()
          })
        );
      }
    });

    await Promise.all(notificationPromises);

    res.json({ 
      success: true, 
      message: 'Regulation published successfully',
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error publishing regulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject regulation (admin only)
router.post('/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (!comment) {
    return res.status(400).json({ 
      success: false, 
      error: 'Comment is required when rejecting a regulation' 
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const regulation = regulationDoc.data();
    
    // Check if in correct status
    if (regulation.status !== 'approved' && regulation.status !== 'under_review') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only approved or under review regulations can be rejected' 
      });
    }

    const updateData = {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedBy: req.user.uid,
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'rejected',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment
      })
    };

    await regulationRef.update(updateData);

    // Notify author and reviewers
    const notificationPromises = [
      // Notify author
      db.collection('notifications').add({
        type: 'regulation_rejected',
        userId: regulation.assignedTo,
        regulationId: id,
        message: `Your regulation "${regulation.title}" has been rejected`,
        read: false,
        createdAt: new Date(),
        comment: comment
      })
    ];

    // Notify reviewers if it was under review
    if (regulation.status === 'under_review') {
      const reviewers = await db.collection('users')
        .where('role', 'in', ['reviewer', 'admin'])
        .get();
      
      reviewers.forEach(doc => {
        if (doc.id !== req.user.uid) { // Don't notify the admin who rejected
          notificationPromises.push(
            db.collection('notifications').add({
              type: 'regulation_rejected',
              userId: doc.id,
              regulationId: id,
              message: `Regulation "${regulation.title}" has been rejected by admin`,
              read: false,
              createdAt: new Date()
            })
          );
        }
      });
    }

    await Promise.all(notificationPromises);

    res.json({ 
      success: true, 
      message: 'Regulation rejected',
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error rejecting regulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get regulations by status
router.get('/status/:status', async (req, res) => {
  const { status } = req.params;
  const { userId } = req.query;
  const validStatuses = ['draft', 'assigned', 'under_review', 'approved', 'published', 'rejected', 'revision_required'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
    });
  }

  try {
    let query = db.collection('regulations')
      .where('status', '==', status)
      .orderBy('updatedAt', 'desc');

    // If user ID is provided, filter by assignedTo
    if (userId) {
      query = query.where('assignedTo', '==', userId);
    }

    const snapshot = await query.get();
    const regulations = [];
    
    snapshot.forEach(doc => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: regulations 
    });
  } catch (error) {
    console.error('Error fetching regulations by status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get regulations assigned to current user
router.get('/assigned/me', async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('regulations')
      .where('assignedTo', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    const regulations = [];
    snapshot.forEach(doc => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: regulations 
    });
  } catch (error) {
    console.error('Error fetching assigned regulations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get regulations requiring review
router.get('/for-review', requireReviewer, async (req, res) => {
  try {
    const snapshot = await db.collection('regulations')
      .where('status', '==', 'under_review')
      .orderBy('submittedAt', 'asc')
      .get();
    
    const regulations = [];
    snapshot.forEach(doc => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: regulations 
    });
  } catch (error) {
    console.error('Error fetching regulations for review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get regulations ready for publication
router.get('/for-publication', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('regulations')
      .where('status', '==', 'approved')
      .orderBy('reviewedAt', 'asc')
      .get();
    
    const regulations = [];
    snapshot.forEach(doc => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: regulations 
    });
  } catch (error) {
    console.error('Error fetching regulations for publication:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get regulation history
router.get('/:id/history', async (req, res) => {
  const { id } = req.params;

  try {
    const doc = await db.collection('regulations').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const regulation = doc.data();
    
    res.json({ 
      success: true, 
      data: regulation.history || [] 
    });
  } catch (error) {
    console.error('Error fetching regulation history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user notifications
router.get('/notifications/me', async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    const notifications = [];
    snapshot.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: notifications 
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection('notifications').doc(id).update({
      read: true,
      readAt: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Notification marked as read' 
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1. Admin assigns regulation to author/employee
router.post('/:id/assign', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { authorId, dueDate } = req.body;
  
  if (!authorId || !dueDate) {
    return res.status(400).json({ 
      success: false, 
      error: 'Author ID and due date are required' 
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    // Verify author exists
    const authorDoc = await db.collection('users').doc(authorId).get();
    if (!authorDoc.exists) {
      return res.status(404).json({ success: false, error: 'Author not found' });
    }

    const updateData = {
      status: 'assigned',
      assignedTo: authorId,
      dueDate: new Date(dueDate),
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'assigned',
        by: req.user.uid,
        to: authorId,
        timestamp: new Date(),
        comment: `Assigned to ${authorDoc.data().name}`
      })
    };

    await regulationRef.update(updateData);
    
    // Notify author about the assignment
    await db.collection('notifications').add({
      type: 'regulation_assigned',
      userId: authorId,
      regulationId: id,
      message: `You have been assigned a new regulation: ${regulationDoc.data().title}`,
      read: false,
      createdAt: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Regulation assigned successfully',
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error assigning regulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Author submits regulation for review
router.post('/:id/submit', async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const regulation = regulationDoc.data();
    
    // Check if user is the assigned author
    if (regulation.assignedTo !== req.user.uid) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only the assigned author can submit for review' 
      });
    }

    // Check if in correct status
    if (!['draft', 'assigned', 'revision_required'].includes(regulation.status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Regulation cannot be submitted for review in its current state' 
      });
    }

    const updateData = {
      status: 'under_review',
      submittedAt: new Date(),
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'submitted_for_review',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment || 'Submitted for review'
      })
    };

    await regulationRef.update(updateData);

    // Notify reviewers
    const reviewers = await db.collection('users')
      .where('role', 'in', ['reviewer', 'admin'])
      .get();
    
    const notificationPromises = [];
    reviewers.forEach(doc => {
      notificationPromises.push(
        db.collection('notifications').add({
          type: 'review_requested',
          userId: doc.id,
          regulationId: id,
          message: `New regulation submitted for review: ${regulation.title}`,
          read: false,
          createdAt: new Date()
        })
      );
    });

    await Promise.all(notificationPromises);

    res.json({ 
      success: true, 
      message: 'Regulation submitted for review',
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error submitting regulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Reviewer reviews regulation
router.post('/:id/review', requireReviewer, async (req, res) => {
  const { id } = req.params;
  const { action, comment } = req.body; // action: 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid action. Must be "approve" or "reject"' 
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({ success: false, error: 'Regulation not found' });
    }

    const regulation = regulationDoc.data();
    
    // Check if in correct status
    if (regulation.status !== 'under_review') {
      return res.status(400).json({ 
        success: false, 
        error: 'Regulation is not in review' 
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'revision_required';
    const updateData = {
      status: newStatus,
      reviewedAt: new Date(),
      reviewedBy: req.user.uid,
      updatedAt: new Date(),
      // Save feedback/comment to both feedback field and history
      feedback: comment || (action === 'approve' ? 'Approved by reviewer' : 'Changes requested'),
      reviewerFeedback: comment || '', // Also store in reviewerFeedback for clarity
      history: db.FieldValue.arrayUnion({
        action: action === 'approve' ? 'approved_by_reviewer' : 'rejected_by_reviewer',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment || (action === 'approve' ? 'Approved by reviewer' : 'Changes requested')
      })
    };

    await regulationRef.update(updateData);

    // Notify author
    await db.collection('notifications').add({
      type: action === 'approve' ? 'review_approved' : 'review_rejected',
      userId: regulation.assignedTo,
      regulationId: id,
      message: action === 'approve' 
        ? `Your regulation "${regulation.title}" has been approved by reviewer`
        : `Your regulation "${regulation.title}" requires changes`,
      read: false,
      createdAt: new Date(),
      comment: comment || ''
    });

    // If approved, notify admin
    if (action === 'approve') {
      const admins = await db.collection('users')
        .where('role', '==', 'admin')
        .get();
      
      const notificationPromises = [];
      admins.forEach(doc => {
        notificationPromises.push(
          db.collection('notifications').add({
            type: 'ready_for_publication',
            userId: doc.id,
            regulationId: id,
            message: `Regulation ready for publication: ${regulation.title}`,
            read: false,
            createdAt: new Date()
          })
        );
      });

      await Promise.all(notificationPromises);
    }

    res.json({ 
      success: true, 
      message: `Regulation ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error processing review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper endpoint to get regulations by status
router.get('/status/:status', async (req, res) => {
  const { status } = req.params;
  const { userId } = req.query;
  const validStatuses = ['draft', 'assigned', 'under_review', 'approved', 'published', 'rejected', 'revision_required'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
    });
  }

  try {
    let query = db.collection('regulations')
      .where('status', '==', status)
      .orderBy('updatedAt', 'desc');

    // If user ID is provided, filter by assignedTo
    if (userId) {
      query = query.where('assignedTo', '==', userId);
    }

    const snapshot = await query.get();
    const regulations = [];
    
    snapshot.forEach(doc => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: regulations 
    });
  } catch (error) {
    console.error('Error fetching regulations by status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get regulations assigned to current user
router.get('/assigned/me', async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('regulations')
      .where('assignedTo', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    const regulations = [];
    snapshot.forEach(doc => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: regulations 
    });
  } catch (error) {
    console.error('Error fetching assigned regulations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get regulations requiring review
router.get('/for-review', requireReviewer, async (req, res) => {
  try {
    const snapshot = await db.collection('regulations')
      .where('status', '==', 'under_review')
      .orderBy('submittedAt', 'asc')
      .get();
    
    const regulations = [];
    snapshot.forEach(doc => {
      regulations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      data: regulations 
    });
  } catch (error) {
    console.error('Error fetching regulations for review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Employee creates and submits a new regulation
router.post('/submit', async (req, res) => {
  try {
    const { 
      title, 
      description, 
      category, 
      content, 
      authorId, 
      authorName 
    } = req.body;

    // Basic validation
    if (!title || !description || !category || !content || !authorId || !authorName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, category, content, authorId, and authorName are required'
      });
    }

    // Create new regulation document
    const regulationData = {
      title,
      description,
      category,
      content,
      status: 'draft',
      referenceNumber: generateRefNumber(),
      createdBy: authorId,
      authorName,
      createdAt: new Date(),
      updatedAt: new Date(),
      history: [{
        action: 'created',
        by: authorId,
        timestamp: new Date(),
        comment: 'Draft created by author'
      }]
    };

    // Save to Firestore
    const docRef = await db.collection('regulations').add(regulationData);
    
    // Submit for review
    const regulationRef = db.collection('regulations').doc(docRef.id);
    const updateData = {
      status: 'under_review',
      submittedAt: new Date(),
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'submitted_for_review',
        by: authorId,
        timestamp: new Date(),
        comment: 'Submitted for initial review'
      })
    };

    await regulationRef.update(updateData);

    // Notify reviewers
    const reviewers = await db.collection('users')
      .where('role', 'in', ['reviewer', 'admin'])
      .get();
    
    const notificationPromises = [];
    reviewers.forEach(doc => {
      notificationPromises.push(
        db.collection('notifications').add({
          type: 'review_requested',
          userId: doc.id,
          regulationId: docRef.id,
          message: `New regulation submitted for review: ${title}`,
          read: false,
          createdAt: new Date()
        })
      );
    });

    await Promise.all(notificationPromises);

    res.status(201).json({
      success: true,
      message: 'Regulation created and submitted for review',
      data: {
        id: docRef.id,
        ...regulationData,
        ...updateData
      }
    });

  } catch (error) {
    console.error('Error creating regulation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create and submit regulation',
      details: error.message
    });
  }
});

// Admin sets a deadline for a regulation
router.post('/:id/deadline', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { dueDate, employeeId, comment } = req.body;

  if (!dueDate || !employeeId) {
    return res.status(400).json({
      success: false,
      error: 'dueDate and employeeId are required'
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Regulation not found'
      });
    }

    // Verify employee exists
    const employeeDoc = await db.collection('users').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    const updateData = {
      assignedTo: employeeId,
      dueDate: new Date(dueDate),
      status: 'assigned',
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'deadline_set',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment || `Deadline set to ${new Date(dueDate).toLocaleDateString()}`,
        details: {
          assignedTo: employeeId,
          dueDate: new Date(dueDate)
        }
      })
    };

    await regulationRef.update(updateData);

    // Notify the employee
    await db.collection('notifications').add({
      type: 'deadline_assigned',
      userId: employeeId,
      regulationId: id,
      message: `You have a new deadline for regulation: ${regulationDoc.data().title}`,
      read: false,
      createdAt: new Date(),
      metadata: {
        dueDate: new Date(dueDate),
        regulationTitle: regulationDoc.data().title,
        comment: comment || ''
      }
    });

    res.json({
      success: true,
      message: 'Deadline set successfully',
      data: {
        id,
        ...updateData,
        dueDate: new Date(dueDate).toISOString()
      }
    });

  } catch (error) {
    console.error('Error setting deadline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set deadline',
      details: error.message
    });
  }
});

// Admin assigns initial deadline or requests revision with deadline
// For initial assignment: only dueDate and employeeId are required
// For revision request: dueDate, employeeId, and comment are required
router.post('/:id/assign', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { dueDate, employeeId, comment, isRevision = false } = req.body;

  if (!dueDate || !employeeId) {
    return res.status(400).json({
      success: false,
      error: 'dueDate and employeeId are required'
    });
  }

  if (isRevision && !comment) {
    return res.status(400).json({
      success: false,
      error: 'Comment is required for revision requests'
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Regulation not found'
      });
    }

    const regulation = regulationDoc.data();
    
    // Verify employee exists
    const employeeDoc = await db.collection('users').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    const isStatusChange = regulation.status !== 'assigned';
    const newStatus = isRevision ? 'revision_required' : 'assigned';
    
    const updateData = {
      status: newStatus,
      assignedTo: employeeId,
      dueDate: new Date(dueDate),
      updatedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: isRevision ? 'revision_requested' : 'deadline_assigned',
        by: req.user.uid,
        timestamp: new Date(),
        comment: comment || `Assigned with deadline: ${new Date(dueDate).toLocaleDateString()}`,
        details: {
          dueDate: new Date(dueDate),
          statusChange: isStatusChange ? `${regulation.status} → ${newStatus}` : undefined,
          isRevisionRequest: isRevision
        }
      })
    };

    await regulationRef.update(updateData);

    // Notify the employee
    const notificationType = isRevision ? 'revision_requested' : 'deadline_assigned';
    const message = isRevision 
      ? `Revision requested for: ${regulation.title}`
      : `You have been assigned to work on: ${regulation.title}`;
    
    await db.collection('notifications').add({
      type: notificationType,
      userId: employeeId,
      regulationId: id,
      message: message,
      read: false,
      createdAt: new Date(),
      metadata: {
        dueDate: new Date(dueDate),
        regulationTitle: regulation.title,
        comment: comment || '',
        status: newStatus,
        assignedBy: req.user.uid,
        isRevisionRequest: isRevision
      }
    });

    // Get the updated regulation
    const updatedDoc = await regulationRef.get();

    res.json({
      success: true,
      message: isRevision ? 'Revision requested successfully' : 'Deadline assigned successfully',
      data: {
        id,
        ...updatedDoc.data(),
        dueDate: new Date(dueDate).toISOString(),
        isRevisionRequest: isRevision
      }
    });

  } catch (error) {
    console.error(`Error ${isRevision ? 'requesting revision' : 'assigning deadline'}:`, error);
    res.status(500).json({
      success: false,
      error: isRevision ? 'Failed to request revision' : 'Failed to assign deadline',
      details: error.message
    });
  }
});

// Employee submits a revision
router.post('/:id/submit-revision', async (req, res) => {
  const { id } = req.params;
  const { content, comment } = req.body;
  const userId = req.user.uid;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Content is required for revision submission'
    });
  }

  try {
    const regulationRef = db.collection('regulations').doc(id);
    const regulationDoc = await regulationRef.get();

    if (!regulationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Regulation not found'
      });
    }

    const regulation = regulationDoc.data();
    
    // Verify user is the assigned employee
    if (regulation.assignedTo !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the assigned employee can submit revisions'
      });
    }

    // Verify regulation is in correct status for revision
    if (regulation.status !== 'revision_required') {
      return res.status(400).json({
        success: false,
        error: 'This regulation is not marked as requiring revision'
      });
    }

    const updateData = {
      content,
      status: 'under_review',
      updatedAt: new Date(),
      lastRevisedAt: new Date(),
      history: db.FieldValue.arrayUnion({
        action: 'revision_submitted',
        by: userId,
        timestamp: new Date(),
        comment: comment || 'Submitted revision',
        details: {
          statusChange: 'revision_required → under_review'
        }
      })
    };

    await regulationRef.update(updateData);

    // Notify admins and reviewers about the revision submission
    const adminsAndReviewers = await db.collection('users')
      .where('role', 'in', ['admin', 'reviewer'])
      .get();

    const notificationPromises = [];
    adminsAndReviewers.forEach(doc => {
      notificationPromises.push(
        db.collection('notifications').add({
          type: 'revision_submitted',
          userId: doc.id,
          regulationId: id,
          message: `Revision submitted for: ${regulation.title}`,
          read: false,
          createdAt: new Date(),
          metadata: {
            submittedBy: userId,
            regulationTitle: regulation.title,
            comment: comment || ''
          }
        })
      );
    });

    await Promise.all(notificationPromises);

    // Get the updated regulation
    const updatedDoc = await regulationRef.get();

    res.json({
      success: true,
      message: 'Revision submitted successfully',
      data: {
        id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    console.error('Error submitting revision:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit revision',
      details: error.message
    });
  }
});

module.exports = router;
