import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();

const db = new pg.Client({
  user: process.env.PG_user,
  host: process.env.PG_host,
  database: process.env.PG_database,
  password: process.env.PG_password,
  port: process.env.PG_port || 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

// Helper to fetch all users from the DB
async function getUsers() {
  const result = await db.query("SELECT * FROM users ORDER BY id ASC");
  return result.rows;
}

async function checkVisisted() {
  // Updated to filter by the current user
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1",
    [currentUserId]
  );
  return result.rows.map((country) => country.country_code);
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const users = await getUsers();
  
  // Find the current user object to get their specific color
  const currentUser = users.find((user) => user.id == currentUserId);

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser ? currentUser.color : "teal",
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length !== 0) {
      const countryCode = result.rows[0].country_code;
      try {
        // Insert country AND associate it with the current user
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
          [countryCode, currentUserId]
        );
        res.redirect("/");
      } catch (err) {
        // Handle duplicate country entry for the same user
        console.log("Country already visited by this user.");
        res.redirect("/");
      }
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    // If the "Add Family Member" button was clicked
    res.render("new.ejs");
  } else {
    // If a specific user button was clicked
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  try {
    // Insert new user and return the generated ID
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    // Set the app to switch to the newly created user immediately
    currentUserId = result.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
