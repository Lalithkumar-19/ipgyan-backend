import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import NewsLetter from './models/NewsLetter';
import Blog from './models/Blog';
import Contacts from './models/Contacts';
import { VerifyAdmin } from './utils';
import nodemailer from 'nodemailer';
import adminModel from './models/Admin';
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
app.use(express.json());
mongoose.connect("mongodb+srv://newsletteripgyan_db_user:6Bvio5jIo1tThNbt@cluster0.r0mccth.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => {
    console.log("Connected to Db successfully ");
  })
  .catch((err) => {
    console.log("Error connecting to Db", err);
  })

// Allow CORS from local dev and general use
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite default
    'http://127.0.0.1:5173'
  ],
  credentials: false
}));

app.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = adminModel.find({ email: email, password: password });
    if (!admin) {
      res.status(401).json({ message: "Unauthorized access denied" });
    }
    const token = jwt.sign({ email: email, password: password }, process.env.JWT_SECRET)
    res.status(200).json({ token: token });

  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})



//api's for Newletter requesting
app.post("/news-letter-req", async (req, res) => {
  const { email } = req.body;
  try {
    const newsLetter = new NewsLetter({ email })
    await newsLetter.save();
    res.status(200).json({ message: "NewsLetter Requested Successfully" })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})



//api's for Blogs 
app.post("/blog", VerifyAdmin, async (req, res) => {
  const { title, description, image, author, category, tags } = req.body;
  try {
    if (!title || !description || !image || !author || !category || !tags) {
      return res.status(400).json({ message: "All fields are required" })
    }
    const blog = new Blog({ title, description, image, author, category, tags })
    await blog.save();
    res.status(200).json({ message: "Blog Created Successfully" })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
});

app.get("/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find();
    res.status(200).json(blogs)
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
});

app.delete("/blog/:id", VerifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await Blog.findByIdAndDelete(id);
    res.status(200).json({ message: "Blog Deleted Successfully" })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})
app.put("/blog/:id", VerifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, description, image, author, category, tags } = req.body;
  try {
    await Blog.findByIdAndUpdate(id, { title, description, image, author, category, tags });
    res.status(200).json({ message: "Blog Updated Successfully" })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})





app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'ipgyan-backend' });
});

// GET /api/google-reviews?placeId=...
app.get('/api/google-reviews', async (req, res) => {
  try {
    const placeId = req.query.placeId || process.env.GOOGLE_PLACE_ID;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY missing' });
    if (!placeId) return res.status(400).json({ error: 'placeId is required (query or env GOOGLE_PLACE_ID)' });

    const fields = 'name,rating,user_ratings_total,reviews';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== 'OK') {
      return res.status(502).json({ error: 'Google API error', details: data });
    }

    const reviews = (data.result.reviews || []).map((r, idx) => ({
      id: r.time || idx,
      name: r.author_name,
      rating: r.rating,
      text: r.text,
      profilePhoto: r.profile_photo_url,
      relativeTime: r.relative_time_description,
      time: r.time,
      authorUrl: r.author_url,
    }));

    res.json({
      place: data.result.name,
      rating: data.result.rating,
      total: data.result.user_ratings_total,
      reviews,
    });
  } catch (err) {
    console.error('Error fetching Google reviews:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//emails sending from google email api

// Send Newsletter to all subscribers (Admin only)
app.post('/send-email', VerifyAdmin, async (req, res) => {
  try {
    const { subject, html, text } = req.body || {};
    if (!subject || (!html && !text)) {
      return res.status(400).json({ message: 'subject and html or text are required' });
    }

    // Collect all subscriber emails
    const subscribers = await NewsLetter.find({}, 'email').lean();
    const bccList = subscribers.map((s) => s.email).filter(Boolean);

    if (!bccList.length) {
      return res.status(400).json({ message: 'No subscribers to send to' });
    }

    // SMTP config from environment
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.FROM_EMAIL || user;

    if (!host || !user || !pass) {
      return res.status(500).json({ message: 'SMTP configuration missing (SMTP_HOST, SMTP_USER, SMTP_PASS)' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for others
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from,
      to: from,             // visible To to avoid bcc-only blocking by some providers
      bcc: bccList,         // all subscribers in BCC
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    return res.status(200).json({
      message: 'Newsletter sent',
      accepted: info.accepted,
      rejected: info.rejected,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Error sending newsletter:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});



//contacts apis
app.get("/get-contacts-list", VerifyAdmin, async (req, res) => {
  try {
    const contacts = await Contacts.find();
    res.status(200).json(contacts);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})


app.post("/create-contact", VerifyAdmin, async (req, res) => {
  try {
    const { fullname, email, subject, message, phone } = req.body;
    if (!fullname || !email || !subject || !message || !phone) {
      return res.status(400).json({ message: "All fields are required" })
    }
    const contact = new Contacts({ fullname, email, subject, message, phone })
    await contact.save();
    res.status(200).json({ message: "Contact Created Successfully" })

  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })

  }
})

app.delete("/delete-contact/:id", VerifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await Contacts.findByIdAndDelete(id);
    res.status(200).json({ message: "Contact Deleted Successfully" })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})

app.put("/update-status/:id", VerifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" })
    }
    await Contacts.findByIdAndUpdate(id, { status });
    res.status(200).json({ message: "Contact Status Updated Successfully" })


  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" })
  }
});




app.listen(PORT, () => {
  console.log(`IPGYAN backend running on http://localhost:${PORT}`);
});