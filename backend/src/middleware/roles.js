const { db } = require('../firebase');

// Middleware to check if user is a reviewer
exports.requireReviewer = async (req, res, next) => {
  try {
    const { userId } = req.user; // Assuming user ID is set by auth middleware
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(403).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data();
    
    if (userData.role !== 'reviewer' && userData.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Reviewer or Admin role required.' 
      });
    }

    next();
  } catch (error) {
    console.error('Reviewer check failed:', error);
    res.status(500).json({ success: false, error: 'Server error during role verification' });
  }
};

// Middleware to check if user is an admin
exports.requireAdmin = async (req, res, next) => {
  try {
    const { userId } = req.user; // Assuming user ID is set by auth middleware
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(403).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data();
    
    if (userData.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    next();
  } catch (error) {
    console.error('Admin check failed:', error);
    res.status(500).json({ success: false, error: 'Server error during admin verification' });
  }
};

// Middleware to get user role
const getUserRole = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    return userDoc.data().role || 'employee';
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

exports.getUserRole = getUserRole;
