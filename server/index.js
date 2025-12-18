const express = require('express')
const cors = require('cors')
// Firestore admin setup requires service account; see README for instructions.
const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Example endpoint: returns sample regulations (replace with Firestore in production)
app.get('/api/regulations', (req, res) => {
  const sample = [
    { title: 'Employee Code O....', ref: 'B0009', status: 'Draft', deadline: '11/4/25', remaining: '3 days' },
    { title: 'Attendance Regula....', ref: 'B0008', status: 'Needs Revision', deadline: '11/4/25', remaining: '12 hours' },
  ]
  res.json(sample)
})

const tryPort = (port) => {
  return new Promise((resolve, reject) => {
    const server = app.listen(port)
      .on('listening', () => {
        console.log(`Server listening on port ${port}`)
        resolve(server)
      })
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is busy, trying next port...`)
          server.close()
          resolve(tryPort(port + 1))
        } else {
          reject(err)
        }
      })
  })
}

const PORT = process.env.PORT || 4000
tryPort(PORT).catch(console.error)
