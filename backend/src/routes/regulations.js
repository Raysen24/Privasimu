const express = require("express");
const router = express.Router();
const { db } = require("../firebase");
const { requireReviewer, requireAdmin } = require("../middleware/roles");

// Helper function to generate reference number
const generateRefNumber = () => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNumber = Math.floor(Math.random() * 9000) + 1000;
  return `${randomLetter}${randomNumber}`;
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

    const updates = {
      status: 'Pending Review',
      submittedAt: new Date(),
      updatedAt: new Date(),
      workflow: {
        currentStage: 'review',
        stages: {
          ...(doc.data().workflow?.stages || {}),
          review: {
            status: 'active',
            timestamp: new Date()
          },
          draft: {
            status: 'completed',
            timestamp: new Date()
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
    console.log('=== NEW REGULATION REQUEST ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    const { 
      title, 
      category, 
      description, 
      notes, 
      deadline, 
      effectiveDate, 
      version = "v1.0",
      attachments = [],
      createdBy,
      code = '',
      status = 'Draft'
    } = req.body;
    
    console.log('Extracted fields:', {
      title,
      category,
      code,
      createdBy,
      hasAttachments: Array.isArray(attachments) ? attachments.length : 'invalid'
    });

    // Basic validation
    if (!title || !category || !createdBy) {
      return res.status(400).json({ 
        success: false, 
        error: "Title, category, and createdBy are required" 
      });
    }

    // Create regulation data
    const regulationData = {
      title,
      category,
      description: description || "",
      notes: notes || "",
      deadline: deadline ? new Date(deadline) : null,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      version,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdBy,
      status,
      code: code || '',  // Ensure empty string if code is undefined
      refNumber: generateRefNumber(),
      createdAt: new Date(),
      updatedAt: new Date(),
      workflow: {
        currentStage: 'draft',
        stages: {
          draft: {
            status: 'active',
            timestamp: new Date()
          }
        }
      }
    };

    console.log('Saving to Firestore:', JSON.stringify(regulationData, null, 2));
    
    console.log('Preparing to save to Firestore:', JSON.stringify(regulationData, null, 2));
    
    // Add to Firestore
    const docRef = await db.collection("regulations").add(regulationData);
    console.log('Document created with ID:', docRef.id);
    
    // Get the created document
    const doc = await docRef.get();
    const savedData = doc.data();
    console.log('Retrieved document data from Firestore:', JSON.stringify(savedData, null, 2));
    
    if (!savedData.code && savedData.code !== '') {
      console.warn('WARNING: Code field is missing or null in the saved document');
    }
    
    // Invalidate cache
    Object.keys(cache).forEach(key => {
      if (key.startsWith('regulations_')) {
        delete cache[key];
      }
    });

    res.status(201).json({ 
      success: true, 
      data: { id: doc.id, ...doc.data() } 
    });
  } catch (error) {
    console.error('Error creating regulation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create regulation' 
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
    const updates = req.body;
    
    // Remove immutable fields
    const { id: _, createdAt, createdBy, refNumber, ...validUpdates } = updates;
    
    // Add updatedAt timestamp
    validUpdates.updatedAt = new Date();
    
    const regulationRef = db.collection("regulations").doc(id);
    const doc = await regulationRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Regulation not found" });
    }
    
    // Check if the user is the creator (only allow updates by creator or admin)
    const regulation = doc.data();
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

// CREATE new regulation
router.post("/", async (req, res) => {
  try {
    const { title, category, description, createdBy } = req.body;

    if (!title || !category || !createdBy) {
      return res.status(400).json({
        success: false,
        error: "Title, category, and createdBy are required"
      });
    }

    const regulationData = {
      title,
      category,
      description: description || "",
      status: "draft",
      refNumber: generateRefNumber(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      version: 1,
      workflow: {
        currentStage: "draft",
        stages: {
          draft: { status: "active", timestamp: new Date() },
          review: { status: "pending" },
          approval: { status: "pending" },
          publish: { status: "pending" }
        }
      },
      isActive: false
    };

    const docRef = await db.collection("regulations").add(regulationData);
    const newDoc = await docRef.get();

    res.status(201).json({
      success: true,
      data: { id: newDoc.id, ...newDoc.data() }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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

    await regulationRef.update({
      status: 'published',
      version: currentVersion + 1,
      publishedAt: now,
      lastUpdated: now,
      isActive: true,
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

module.exports = router;
