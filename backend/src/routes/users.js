const express = require("express");
const router = express.Router();
const { db } = require("../firebase");

// GET all users
router.get("/", async (req, res) => {
  try {
    const { role, email } = req.query;
    let query = db.collection("users");

    // Apply filters
    if (role) {
      query = query.where("role", "==", role);
    }
    if (email) {
      query = query.where("email", "==", email);
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();
    const users = [];
    
    snapshot.forEach((doc) => {
      const userData = doc.data();
      // Don't send sensitive data
      delete userData.password;
      users.push({
        id: doc.id,
        ...userData,
      });
    });

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("users").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const userData = doc.data();
    delete userData.password; // Don't send password

    res.json({ success: true, data: { id: doc.id, ...userData } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create new user
router.post("/", async (req, res) => {
  try {
    const {
      email,
      name,
      role = "employee", // employee, reviewer, approver, admin
      department,
      password, // In production, this should be hashed
    } = req.body;

    // Validation
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: "Email and name are required",
      });
    }

    // Check if user already exists
    const existingUser = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (!existingUser.empty) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    const userData = {
      email,
      name,
      role,
      department: department || "",
      password: password || "", // In production, hash this
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastLogin: null,
    };

    const docRef = await db.collection("users").add(userData);
    
    // Don't send password in response
    delete userData.password;

    res.status(201).json({
      success: true,
      data: { id: docRef.id, ...userData },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.password; // Password updates should be handled separately

    updateData.updatedAt = new Date();

    const docRef = db.collection("users").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    const userData = updatedDoc.data();
    delete userData.password;

    res.json({
      success: true,
      data: { id: updatedDoc.id, ...userData },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE user (soft delete by setting isActive to false)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("users").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Soft delete
    await docRef.update({
      isActive: false,
      updatedAt: new Date(),
    });

    res.json({ success: true, message: "User deactivated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET user statistics
router.get("/:id/stats", async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's regulations
    const regulationsSnapshot = await db
      .collection("regulations")
      .where("createdBy", "==", id)
      .get();

    const regulations = [];
    regulationsSnapshot.forEach((doc) => {
      regulations.push(doc.data());
    });

    // Calculate statistics
    const stats = {
      totalRegulations: regulations.length,
      byStatus: {
        Draft: regulations.filter((r) => r.status === "Draft").length,
        "Pending Review": regulations.filter((r) => r.status === "Pending Review").length,
        "Needs Revision": regulations.filter((r) => r.status === "Needs Revision").length,
        "Pending Approval": regulations.filter((r) => r.status === "Pending Approval").length,
        "Pending Publish": regulations.filter((r) => r.status === "Pending Publish").length,
        Published: regulations.filter((r) => r.status === "Published").length,
      },
      overdue: regulations.filter((r) => {
        if (!r.deadline) return false;
        return new Date(r.deadline.toDate()) < new Date() && r.status !== "Published";
      }).length,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

