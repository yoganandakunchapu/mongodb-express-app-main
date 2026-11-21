import express from "express";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 7000;

// MongoDB connection
const mongoUrl =
  process.env.MONGO_URI ||
  process.env.MONGO_FULL_URI ||
  process.env.MONGODB_URI ||
  "mongodb://admin:admin123@localhost:27017";
const databaseName = process.env.DB_NAME || "library_db";

const client = new MongoClient(mongoUrl);

let db;

async function connectToMongo() {
  try {
    await client.connect();
    db = client.db(databaseName);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
      console.warn(
        "Notice: Running with default localhost MongoDB URL. When deploying to Render, set the MONGO_URI environment variable."
      );
    }
  }
}

connectToMongo();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root and Health routes
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Library MongoDB Express API is running!",
    databaseStatus: db ? "Connected" : "Not connected (check MONGO_URI in Render settings)",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", database: db ? "connected" : "disconnected" });
});

// Guard API routes if database is not connected
app.use("/api", (req, res, next) => {
  if (!db) {
    return res.status(503).json({
      message:
        "Database is not connected. Please set a valid MONGO_URI environment variable in your Render dashboard.",
    });
  }
  next();
});

// CRUD API endpoints
// Create a new book - POST /api/v1/books
app.post("/api/v1/books", async (req, res, next) => {
  try {
    const { title, author, category, price } = req.body;
    if (!title || !author || !category || !price) {
      return res.status(400).json({ message: "All book fields are required" });
    }
    const result = await db.collection("books").insertOne({ title, author, category, price });
    const newBook = {
      _id: result.insertedId,
      title,
      author,
      category,
      price,
    };
    res.status(201).json({ message: "Book created successfully", data: newBook });
  } catch (err) {
    next(err);
  }
});

// Get books by category - GET /api/v1/books?category=categoryName
// Get all books - GET /api/v1/books
app.get("/api/v1/books", async (req, res, next) => {
  try {
    const category = req.query.category;
    const query = category ? { category } : {};
    const books = await db.collection("books").find(query).toArray();
    res.status(200).json({ message: "Books fetched successfully", data: books });
  } catch (err) {
    next(err);
  }
});

// Get a single book by ID - GET /api/v1/books/:id
app.get("/api/v1/books/:id", async (req, res, next) => {
  try {
    const bookId = req.params.id;
    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }
    const book = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json({ message: "Book fetched successfully", data: book });
  } catch (err) {
    next(err);
  }
});

// Update a book by ID - PUT /api/v1/books/:id
app.put("/api/v1/books/:id", async (req, res, next) => {
  try {
    const bookId = req.params.id;
    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }
    const { title, author, category, price } = req.body;
    if (!title || !author || !category || !price) {
      return res.status(400).json({ message: "All book fields are required" });
    }
    const book = { title, author, category, price };
    const result = await db
      .collection("books")
      .updateOne({ _id: new ObjectId(bookId) }, { $set: book });
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json({
      message: "Book updated successfully",
      data: { _id: new ObjectId(bookId), ...book },
    });
  } catch (err) {
    next(err);
  }
});

// Delete a book by ID - DELETE /api/v1/books/:id
app.delete("/api/v1/books/:id", async (req, res, next) => {
  try {
    const bookId = req.params.id;
    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }
    const result = await db.collection("books").deleteOne({ _id: new ObjectId(bookId) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json({ message: "Book deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// 404 Not Found middleware
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Internal Server Error" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
