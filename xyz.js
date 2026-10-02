/*
===========================================================
                 PERSONAL BUDDY 🌸
===========================================================

FULL STACK SINGLE FILE PROJECT

Features:
- Registration
- Login
- SQLite Database
- Password Hashing
- Dates & Events
- Goal Planner
- Short Term Goals
- Long Term Goals
- Medicine Reminder
- To-Do List
- Birthday & Anniversary
- Bill Reminder
- Automatic Email Reminder
- Gmail SMTP
- Registration Email = Reminder Email
- Light Pink + Light Blue UI

RUN:
npm.cmd install express better-sqlite3 bcryptjs express-session nodemailer node-cron
node xyz.js

OPEN:
http://localhost:3000
===========================================================
*/

const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const https = require("https");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;


/* =========================================================
   GMAIL CONFIGURATION
========================================================= */

/*
   IMPORTANT:

   GMAIL_USER =
   Gmail account used to SEND emails.

   GMAIL_APP_PASSWORD =
   16-digit Gmail App Password.

   The reminder receiver is NOT written here.

   Reminder receiver is automatically:
   user.email

   Therefore:
   Registration Email = Reminder Email
*/

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const RESEND_FROM_EMAIL = "onboarding@resend.dev";


/* =========================================================
   DATABASE
========================================================= */

const db = new Database("personal-buddy.db");

db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reminder_date TEXT NOT NULL,
    reminder_time TEXT NOT NULL,
    goal_type TEXT,
    completed INTEGER DEFAULT 0,
    email_sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);
`);


/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


/* =========================================================
   SESSION
========================================================= */

app.use(
    session({
        secret: "PERSONAL_BUDDY_SECRET_2026_CHANGE_ME",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);




/* =========================================================
   GMAIL CONNECTION TEST
========================================================= */

if (
    GMAIL_USER !== "YOUR_GMAIL@gmail.com" &&
    GMAIL_APP_PASSWORD !==
        "YOUR_16_DIGIT_GMAIL_APP_PASSWORD"
) {

    transporter.verify((error) => {

        if (error) {

            console.error(
                "❌ Gmail connection failed:"
            );

            console.error(
                error.message
            );

        } else {

            console.log(
                "✅ Gmail SMTP connection successful!"
            );

        }

    });

} else {

    console.log(
        "⚠️ Gmail is not configured yet."
    );

}
/* =========================================================
   LOGIN CHECK
========================================================= */

function requireLogin(req, res, next) {

    if (!req.session.userId) {

        return res.status(401).json({
            success: false,
            message: "Please login first."
        });

    }

    next();

}


/* =========================================================
   REGISTER
========================================================= */

app.post("/api/register", async (req, res) => {

    try {

        let {
            name,
            mobile,
            email,
            password,
            confirmPassword
        } = req.body;


        name = String(name || "").trim();
        mobile = String(mobile || "").trim();
        email = String(email || "").trim().toLowerCase();
        password = String(password || "");
        confirmPassword =
            String(confirmPassword || "");


        if (
            !name ||
            !mobile ||
            !email ||
            !password ||
            !confirmPassword
        ) {

            return res.status(400).json({
                success: false,
                message: "Please fill all fields."
            });

        }


        if (password !== confirmPassword) {

            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            });

        }


        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 6 characters."
            });

        }


        const existing = db.prepare(`
            SELECT *
            FROM users
            WHERE mobile = ?
               OR email = ?
        `).get(
            mobile,
            email
        );


        if (existing) {

            return res.status(400).json({
                success: false,
                message:
                    "Mobile number or Email already exists."
            });

        }


        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        const result = db.prepare(`
            INSERT INTO users
            (
                name,
                mobile,
                email,
                password
            )
            VALUES (?, ?, ?, ?)
        `).run(
            name,
            mobile,
            email,
            hashedPassword
        );


        req.session.userId =
            result.lastInsertRowid;


        console.log(
            "REGISTERED USER:",
            email
        );


        res.json({

            success: true,

            message:
                "Registration successful!"

        });


    } catch (error) {

        console.error(
            "REGISTER ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Registration failed."

        });

    }

});


/* =========================================================
   LOGIN
========================================================= */

app.post("/api/login", async (req, res) => {

    try {

        const mobile =
            String(
                req.body.mobile || ""
            ).trim();

        const password =
            String(
                req.body.password || ""
            );


        if (!mobile || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Mobile number and password are required."

            });

        }


        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE mobile = ?
        `).get(mobile);


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid mobile number or password."

            });

        }


        const valid =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!valid) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid mobile number or password."

            });

        }


        req.session.userId =
            user.id;


        res.json({

            success: true,

            message:
                "Login successful!"

        });


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Login failed."

        });

    }

});


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/me",
    requireLogin,
    (req, res) => {

        const user = db.prepare(`
            SELECT
                id,
                name,
                mobile,
                email
            FROM users
            WHERE id = ?
        `).get(
            req.session.userId
        );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }


        res.json({

            success: true,

            user: user

        });

    }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(() => {

            res.json({
                success: true
            });

        });

    }
);


/* =========================================================
   GET REMINDERS
========================================================= */

app.get(
    "/api/reminders",
    requireLogin,
    (req, res) => {

        const reminders =
            db.prepare(`
                SELECT *
                FROM reminders
                WHERE user_id = ?
                ORDER BY
                    reminder_date ASC,
                    reminder_time ASC
            `).all(
                req.session.userId
            );


        res.json({

            success: true,

            reminders: reminders

        });

    }
);


/* =========================================================
   ADD REMINDER
========================================================= */

app.post(
    "/api/reminders",
    requireLogin,
    (req, res) => {

        try {

            const {
                type,
                title,
                description,
                reminderDate,
                reminderTime,
                goalType
            } = req.body;


            if (
                !type ||
                !title ||
                !reminderDate ||
                !reminderTime
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please fill all required fields."

                });

            }


            const result =
                db.prepare(`
                    INSERT INTO reminders
                    (
                        user_id,
                        type,
                        title,
                        description,
                        reminder_date,
                        reminder_time,
                        goal_type
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(

                    req.session.userId,

                    type,

                    title.trim(),

                    description || "",

                    reminderDate,

                    reminderTime,

                    goalType || null

                );


            res.json({

                success: true,

                message:
                    "Reminder added successfully!",

                id:
                    result.lastInsertRowid

            });


        } catch (error) {

            console.error(
                "ADD REMINDER ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Could not add reminder."

            });

        }

    }
);


/* =========================================================
   TOGGLE REMINDER
========================================================= */

app.put(
    "/api/reminders/:id/toggle",
    requireLogin,
    (req, res) => {

        const reminder =
            db.prepare(`
                SELECT *
                FROM reminders
                WHERE id = ?
                AND user_id = ?
            `).get(

                req.params.id,

                req.session.userId

            );


        if (!reminder) {

            return res.status(404).json({

                success: false,

                message:
                    "Reminder not found."

            });

        }


        const completed =
            reminder.completed
                ? 0
                : 1;


        db.prepare(`
            UPDATE reminders
            SET completed = ?
            WHERE id = ?
        `).run(

            completed,

            reminder.id

        );


        res.json({
            success: true
        });

    }
);


/* =========================================================
   DELETE REMINDER
========================================================= */

app.delete(
    "/api/reminders/:id",
    requireLogin,
    (req, res) => {

        db.prepare(`
            DELETE FROM reminders
            WHERE id = ?
            AND user_id = ?
        `).run(

            req.params.id,

            req.session.userId

        );


        res.json({

            success: true,

            message:
                "Reminder deleted."

        });

    }
);


/* =========================================================
   SEND REMINDER EMAIL - RESEND
========================================================= */

async function sendReminderEmail(user, reminder) {

    try {

        if (!RESEND_API_KEY) {
            console.log("❌ RESEND_API_KEY is not configured.");
            return false;
        }

        const emailHTML =
            "<!DOCTYPE html>" +
            "<html>" +
            "<body style=\"" +
            "margin:0;padding:30px;background:#ffeaf3;" +
            "font-family:Arial,sans-serif;\">" +

            "<div style=\"" +
            "max-width:600px;margin:auto;background:white;" +
            "padding:35px;border-radius:25px;" +
            "box-shadow:0 10px 35px rgba(0,0,0,.12);\">" +

            "<h1 style=\"text-align:center;color:#d63384;\">" +
            "🌸 Personal Buddy" +
            "</h1>" +

            "<h2 style=\"color:#1976d2;\">" +
            "Hello " +
            escapeEmailHTML(user.name) +
            " 👋" +
            "</h2>" +

            "<p>This is your Personal Buddy reminder.</p>" +

            "<div style=\"" +
            "background:#e3f5ff;padding:22px;" +
            "border-radius:18px;\">" +

            "<p><b>📌 Title:</b> " +
            escapeEmailHTML(reminder.title) +
            "</p>" +

            "<p><b>📂 Category:</b> " +
            escapeEmailHTML(reminder.type) +
            "</p>" +

            "<p><b>📅 Date:</b> " +
            escapeEmailHTML(reminder.reminder_date) +
            "</p>" +

            "<p><b>⏰ Time:</b> " +
            escapeEmailHTML(reminder.reminder_time) +
            "</p>" +

            "<p><b>📝 Description:</b> " +
            escapeEmailHTML(
                reminder.description || "No description"
            ) +
            "</p>" +

            (
                reminder.goal_type
                    ? "<p><b>🎯 Goal Type:</b> " +
                      escapeEmailHTML(reminder.goal_type) +
                      "</p>"
                    : ""
            ) +

            "</div>" +

            "<p style=\"color:#607d8b;margin-top:25px;\">" +
            "Stay organized and take care of yourself 💙" +
            "</p>" +

            "<hr>" +

            "<p style=\"text-align:center;color:#999;\">" +
            "Personal Buddy Automatic Email Reminder" +
            "</p>" +

            "</div>" +
            "</body>" +
            "</html>";


        const response = await fetch(
            "https://api.resend.com/emails",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        "Bearer " + RESEND_API_KEY,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    from:
                        "Personal Buddy 🌸 <onboarding@resend.dev>",

                    to:
                        [user.email],

                    subject:
                        "🔔 Personal Buddy Reminder: " +
                        reminder.title,

                    html:
                        emailHTML
                })
            }
        );


        const result = await response.json();


        if (!response.ok) {

            console.error(
                "❌ RESEND EMAIL ERROR:"
            );

            console.error(result);

            return false;
        }


        console.log(
            "================================================"
        );

        console.log(
            "✅ REMINDER EMAIL SENT"
        );

        console.log(
            "User:",
            user.name
        );

        console.log(
            "Email:",
            user.email
        );

        console.log(
            "Reminder:",
            reminder.title
        );

        console.log(
            "Resend ID:",
            result.id
        );

        console.log(
            "================================================"
        );


        return true;


    } catch (error) {

        console.error(
            "❌ EMAIL ERROR:"
        );

        console.error(
            error.message
        );

        return false;
    }
}

/* =========================================================
   EMAIL HTML ESCAPE
========================================================= */

function escapeEmailHTML(value) {

    return String(value || "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   CHECK REMINDERS - INDIA TIME (IST)
========================================================= */

async function checkReminders() {

    try {

        // Current India time
        const now = new Date();

        const indiaTime = new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }
        ).formatToParts(now);

        const getPart = (type) =>
            indiaTime.find(
                part => part.type === type
            ).value;

        const currentDate =
            `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

        const currentTime =
            `${getPart("hour")}:${getPart("minute")}`;

        console.log(
            `🕐 Checking reminders: ${currentDate} ${currentTime} IST`
        );


        /* =====================================================
           FIND DUE REMINDERS
        ===================================================== */

        const reminders = db.prepare(`

            SELECT
                reminders.*,
                users.name,
                users.email

            FROM reminders

            JOIN users
            ON users.id = reminders.user_id

            WHERE
                reminders.reminder_date = ?

            AND
                reminders.reminder_time <= ?

            AND
                reminders.completed = 0

            AND
                reminders.email_sent = 0

        `).all(

            currentDate,
            currentTime

        );


        if (reminders.length === 0) {

            console.log(
                "📭 No reminders due."
            );

            return;
        }


        console.log(
            `🔔 ${reminders.length} reminder(s) found.`
        );


        /* =====================================================
           SEND EMAIL
        ===================================================== */

        for (
            const reminder
            of reminders
        ) {

            try {

                console.log(
                    `📧 Sending reminder: ${reminder.title}`
                );

                console.log(
                    `📩 To: ${reminder.email}`
                );


                await sendReminderEmail(

                    {
                        name:
                            reminder.name,

                        email:
                            reminder.email
                    },

                    reminder

                );


                /* =============================================
                   MARK EMAIL AS SENT ONLY AFTER SUCCESS
                ============================================= */

                db.prepare(`

                    UPDATE reminders

                    SET email_sent = 1

                    WHERE id = ?

                `).run(

                    reminder.id

                );


                console.log(
                    `✅ Email sent successfully: ${reminder.title}`
                );

            }

            catch (emailError) {

                console.error(
                    `❌ Failed to send email for reminder ${reminder.id}:`
                );

                console.error(
                    emailError.message
                );

            }

        }

    }

    catch (error) {

        console.error(
            "❌ checkReminders() error:"
        );

        console.error(
            error.message
        );

    }

}


/* =========================================================
   FRONTEND
========================================================= */

const HTML = `<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1.0"
>

<title>Personal Buddy 🌸</title>

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
font-family:Arial,Helvetica,sans-serif;
}

body{
min-height:100vh;

background:
linear-gradient(
135deg,
rgba(255,192,203,.90),
rgba(173,216,230,.90)
),
url("https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1800&q=85");

background-size:cover;
background-position:center;
background-attachment:fixed;

color:#263238;
}

.hidden{
display:none!important;
}

button{
cursor:pointer;
}

.auth-page{
min-height:100vh;
display:flex;
align-items:center;
justify-content:center;
padding:20px;
}

.auth-card{
width:100%;
max-width:470px;
background:rgba(255,255,255,.95);
padding:38px;
border-radius:28px;

box-shadow:
0 20px 60px
rgba(0,0,0,.20);
}

.logo{
text-align:center;
color:#d63384;
font-size:36px;
font-weight:800;
margin-bottom:8px;
}

.subtitle{
text-align:center;
color:#607d8b;
margin-bottom:25px;
}

.form-group{
margin-bottom:16px;
}

.form-group label{
display:block;
color:#455a64;
font-weight:bold;
margin-bottom:7px;
}

input,
select,
textarea{
width:100%;
padding:14px;
border:2px solid #e1bee7;
border-radius:12px;
outline:none;
background:white;
font-size:15px;
}

input:focus,
select:focus,
textarea:focus{
border-color:#42a5f5;

box-shadow:
0 0 0 3px
rgba(66,165,245,.12);
}

textarea{
min-height:100px;
resize:vertical;
}

.primary-btn{
width:100%;
padding:14px;
border:0;
border-radius:12px;
color:white;
font-size:16px;
font-weight:bold;

background:
linear-gradient(
135deg,
#ec6aa8,
#42a5f5
);
}

.switch{
text-align:center;
margin-top:20px;
color:#607d8b;
}

.switch span{
color:#d63384;
font-weight:bold;
cursor:pointer;
}

.message{
padding:12px;
border-radius:10px;
margin-bottom:15px;
text-align:center;
display:none;
}

.navbar{
position:sticky;
top:0;
z-index:99;

padding:17px 30px;

background:rgba(255,255,255,.95);

box-shadow:
0 5px 25px
rgba(0,0,0,.08);

display:flex;
justify-content:space-between;
align-items:center;
}

.brand{
font-size:27px;
font-weight:800;
color:#d63384;
}

.nav-right{
display:flex;
align-items:center;
gap:15px;
}

.username{
font-weight:bold;
color:#455a64;
}

.logout{
border:0;
padding:9px 17px;
background:#ef5350;
color:white;
border-radius:9px;
font-weight:bold;
}

.container{
max-width:1300px;
margin:auto;
padding:30px 25px;
}

.welcome{
background:
linear-gradient(
135deg,
rgba(255,255,255,.96),
rgba(235,248,255,.96)
);

padding:30px;
border-radius:25px;
margin-bottom:28px;

box-shadow:
0 10px 30px
rgba(0,0,0,.08);
}

.welcome h1{
color:#d63384;
margin-bottom:8px;
}

.welcome p{
color:#607d8b;
}

.modules{
display:grid;

grid-template-columns:
repeat(
auto-fit,
minmax(220px,1fr)
);

gap:20px;
margin-bottom:30px;
}

.module{
background:rgba(255,255,255,.94);
padding:25px;
border-radius:22px;

box-shadow:
0 10px 30px
rgba(0,0,0,.08);

transition:.25s;
cursor:pointer;
border:2px solid transparent;
}

.module:hover{
transform:translateY(-6px);
border-color:#90caf9;
}

.icon{
font-size:40px;
margin-bottom:12px;
}

.module h3{
color:#37474f;
margin-bottom:7px;
}

.module p{
color:#78909c;
font-size:14px;
line-height:1.5;
}

.card{
background:rgba(255,255,255,.95);
padding:28px;
border-radius:24px;
margin-bottom:30px;

box-shadow:
0 10px 30px
rgba(0,0,0,.08);
}

.card h2{
color:#d63384;
margin-bottom:20px;
}

.form-grid{
display:grid;

grid-template-columns:
repeat(
auto-fit,
minmax(220px,1fr)
);

gap:16px;
}

.full{
grid-column:1/-1;
}

.add-btn{
border:0;
padding:13px 24px;

background:
linear-gradient(
135deg,
#ec6aa8,
#42a5f5
);

color:white;
border-radius:12px;
font-weight:bold;
}

.goal-options{
display:flex;
gap:12px;
}

.goal{
flex:1;
padding:14px;
border:2px solid #bbdefb;
background:#f5fbff;
border-radius:12px;
text-align:center;
font-weight:bold;
cursor:pointer;
}

.goal.selected{
background:#e3f2fd;
border-color:#42a5f5;
color:#1976d2;
}

.reminder-title{
color:#37474f;
margin-bottom:18px;
}

.reminders{
display:grid;

grid-template-columns:
repeat(
auto-fit,
minmax(280px,1fr)
);

gap:18px;
}

.reminder{
background:rgba(255,255,255,.95);
padding:21px;
border-radius:18px;
border-left:6px solid #42a5f5;

box-shadow:
0 8px 25px
rgba(0,0,0,.08);
}

.reminder.completed{
opacity:.55;
border-left-color:#66bb6a;
}

.reminder-category{
color:#d63384;
font-size:12px;
font-weight:bold;
text-transform:uppercase;
margin-bottom:8px;
}

.reminder h3{
color:#37474f;
margin-bottom:10px;
}

.date-time{
color:#1976d2;
font-weight:bold;
line-height:1.7;
}

.description{
color:#607d8b;
margin:10px 0 15px;
line-height:1.5;
}

.actions{
display:flex;
gap:8px;
}

.complete-btn{
border:0;
background:#c8e6c9;
color:#2e7d32;
padding:9px 13px;
border-radius:9px;
font-weight:bold;
}

.delete-btn{
border:0;
background:#ffcdd2;
color:#c62828;
padding:9px 13px;
border-radius:9px;
font-weight:bold;
}

footer{
text-align:center;
padding:30px;
color:#546e7a;
}

@media(max-width:600px){

.navbar{
flex-direction:column;
gap:12px;
padding:15px;
}

.nav-right{
width:100%;
justify-content:space-between;
}

.container{
padding:18px 13px;
}

.auth-card{
padding:28px 20px;
}

.logo{
font-size:30px;
}

.goal-options{
flex-direction:column;
}

}

</style>

</head>

<body>


<!-- REGISTER -->

<section
id="registerPage"
class="auth-page"
>

<div class="auth-card">

<div class="logo">
🌸 Personal Buddy
</div>

<div class="subtitle">
Create your account
</div>

<div
id="registerMessage"
class="message"
></div>

<form id="registerForm">

<div class="form-group">

<label>Full Name</label>

<input
id="registerName"
type="text"
placeholder="Enter your name"
required
>

</div>

<div class="form-group">

<label>Mobile Number</label>

<input
id="registerMobile"
type="tel"
placeholder="Enter mobile number"
required
>

</div>

<div class="form-group">

<label>Email ID</label>

<input
id="registerEmail"
type="email"
placeholder="Enter email ID"
required
>

</div>

<div class="form-group">

<label>Password</label>

<input
id="registerPassword"
type="password"
placeholder="Create password"
required
>

</div>

<div class="form-group">

<label>Confirm Password</label>

<input
id="registerConfirm"
type="password"
placeholder="Confirm password"
required
>

</div>

<button
class="primary-btn"
type="submit"
>
Create Account
</button>

</form>

<div class="switch">

Already registered?

<span onclick="showLogin()">
Login
</span>

</div>

</div>

</section>


<!-- LOGIN -->

<section
id="loginPage"
class="auth-page hidden"
>

<div class="auth-card">

<div class="logo">
🌸 Personal Buddy
</div>

<div class="subtitle">
Welcome Back 💙
</div>

<div
id="loginMessage"
class="message"
></div>

<form id="loginForm">

<div class="form-group">

<label>Mobile Number</label>

<input
id="loginMobile"
type="tel"
placeholder="Enter mobile number"
required
>

</div>

<div class="form-group">

<label>Password</label>

<input
id="loginPassword"
type="password"
placeholder="Enter password"
required
>

</div>

<button
class="primary-btn"
type="submit"
>
Login
</button>

</form>

<div class="switch">

New user?

<span onclick="showRegister()">
Create Account
</span>

</div>

</div>

</section>


<!-- DASHBOARD -->

<section
id="dashboard"
class="hidden"
>

<nav class="navbar">

<div class="brand">
🌸 Personal Buddy
</div>

<div class="nav-right">

<span
id="navName"
class="username"
>
User
</span>

<button
class="logout"
onclick="logout()"
>
Logout
</button>

</div>

</nav>


<div class="container">

<div class="welcome">

<h1>
Hello,
<span id="welcomeName">
Buddy
</span>
👋
</h1>

<p>
Your personal assistant for
events, goals, medicines,
tasks, birthdays and bills.
</p>

</div>


<!-- MODULES -->

<div class="modules">

<div
class="module"
onclick="selectCategory('Dates & Events')"
>

<div class="icon">📅</div>

<h3>Dates & Events</h3>

<p>
Add date and exact time
for important events.
</p>

</div>


<div
class="module"
onclick="selectCategory('Goal Planner')"
>

<div class="icon">🎯</div>

<h3>Goal Planner</h3>

<p>
Plan your short-term and
long-term goals.
</p>

</div>


<div
class="module"
onclick="selectCategory('Medicine Reminder')"
>

<div class="icon">💊</div>

<h3>Medicine Reminder</h3>

<p>
Get reminders for your
medicine schedule.
</p>

</div>


<div
class="module"
onclick="selectCategory('To-Do List')"
>

<div class="icon">✅</div>

<h3>To-Do List</h3>

<p>
Organize your daily tasks.
</p>

</div>


<div
class="module"
onclick="selectCategory('Birthday & Anniversary')"
>

<div class="icon">🎂</div>

<h3>Birthday & Anniversary</h3>

<p>
Never forget special dates.
</p>

</div>


<div
class="module"
onclick="selectCategory('Bill Reminder')"
>

<div class="icon">💰</div>

<h3>Bill Reminder</h3>

<p>
Remember your important
payments.
</p>

</div>

</div>


<!-- ADD REMINDER -->

<div
id="reminderFormCard"
class="card"
>

<h2>
➕ Add New Reminder
</h2>

<form id="reminderForm">

<div class="form-grid">

<div class="form-group">

<label>Category</label>

<select
id="category"
required
>

<option value="">
Select Category
</option>

<option>
Dates & Events
</option>

<option>
Goal Planner
</option>

<option>
Medicine Reminder
</option>

<option>
To-Do List
</option>

<option>
Birthday & Anniversary
</option>

<option>
Bill Reminder
</option>

</select>

</div>


<div class="form-group">

<label>Title</label>

<input
id="title"
type="text"
placeholder="Reminder title"
required
>

</div>


<div
id="goalBox"
class="form-group"
style="display:none"
>

<label>Goal Type</label>

<div class="goal-options">

<div
id="shortGoal"
class="goal"
onclick="setGoal('Short Term Goal')"
>
🎯 Short Term Goal
</div>

<div
id="longGoal"
class="goal"
onclick="setGoal('Long Term Goal')"
>
🚀 Long Term Goal
</div>

</div>

<input
id="goalType"
type="hidden"
>

</div>


<div class="form-group">

<label>Date</label>

<input
id="date"
type="date"
required
>

</div>


<div class="form-group">

<label>Time</label>

<input
id="time"
type="time"
required
>

</div>


<div class="form-group full">

<label>
Description / Notes
</label>

<textarea
id="description"
placeholder="Enter details..."
></textarea>

</div>


<div class="full">

<button
class="add-btn"
type="submit"
>
🔔 Add Reminder
</button>

</div>

</div>

</form>

</div>


<h2 class="reminder-title">
🔔 My Reminders
</h2>

<div
id="reminders"
class="reminders"
></div>

</div>


<footer>
🌸 Personal Buddy © 2026
</footer>

</section>


<script>

/* =========================================================
   AUTH
========================================================= */

function showLogin(){

document
.getElementById("registerPage")
.classList.add("hidden");

document
.getElementById("loginPage")
.classList.remove("hidden");

}


function showRegister(){

document
.getElementById("loginPage")
.classList.add("hidden");

document
.getElementById("registerPage")
.classList.remove("hidden");

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
id,
text,
success
){

const box =
document.getElementById(id);

box.innerText = text;

box.style.display = "block";

if(success){

box.style.background =
"#c8e6c9";

box.style.color =
"#2e7d32";

}else{

box.style.background =
"#ffcdd2";

box.style.color =
"#c62828";

}

}


/* =========================================================
   REGISTER
========================================================= */

document
.getElementById("registerForm")
.addEventListener(
"submit",
async function(e){

e.preventDefault();

const data = {

name:
document
.getElementById("registerName")
.value.trim(),

mobile:
document
.getElementById("registerMobile")
.value.trim(),

email:
document
.getElementById("registerEmail")
.value.trim(),

password:
document
.getElementById("registerPassword")
.value,

confirmPassword:
document
.getElementById("registerConfirm")
.value

};


try{

const response =
await fetch(
"/api/register",
{
method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:
JSON.stringify(data)
}
);


const result =
await response.json();


showMessage(
"registerMessage",
result.message,
result.success
);


if(result.success){

setTimeout(
loadDashboard,
700
);

}

}catch(error){

showMessage(
"registerMessage",
"Server connection error.",
false
);

}

}
);


/* =========================================================
   LOGIN
========================================================= */

document
.getElementById("loginForm")
.addEventListener(
"submit",
async function(e){

e.preventDefault();

const data = {

mobile:
document
.getElementById("loginMobile")
.value.trim(),

password:
document
.getElementById("loginPassword")
.value

};


try{

const response =
await fetch(
"/api/login",
{
method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:
JSON.stringify(data)
}
);


const result =
await response.json();


showMessage(
"loginMessage",
result.message,
result.success
);


if(result.success){

setTimeout(
loadDashboard,
500
);

}

}catch(error){

showMessage(
"loginMessage",
"Server connection error.",
false
);

}

}
);


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard(){

try{

const response =
await fetch("/api/me");


if(!response.ok){

showRegister();

return;

}


const result =
await response.json();


document
.getElementById("registerPage")
.classList.add("hidden");

document
.getElementById("loginPage")
.classList.add("hidden");

document
.getElementById("dashboard")
.classList.remove("hidden");


document
.getElementById("welcomeName")
.innerText =
result.user.name;


document
.getElementById("navName")
.innerText =
result.user.name;


loadReminders();


}catch(error){

console.log(error);

}

}


/* =========================================================
   SELECT CATEGORY
========================================================= */

function selectCategory(category){

document
.getElementById("category")
.value =
category;

showGoalBox(category);

document
.getElementById("reminderFormCard")
.scrollIntoView({
behavior:"smooth"
});

}


/* =========================================================
   GOAL BOX
========================================================= */

function showGoalBox(category){

const box =
document.getElementById("goalBox");


if(
category ===
"Goal Planner"
){

box.style.display =
"block";

}else{

box.style.display =
"none";

}

}


document
.getElementById("category")
.addEventListener(
"change",
function(){

showGoalBox(
this.value
);

}
);


/* =========================================================
   GOAL SELECT
========================================================= */

function setGoal(type){

document
.getElementById("goalType")
.value =
type;


document
.getElementById("shortGoal")
.classList.remove(
"selected"
);


document
.getElementById("longGoal")
.classList.remove(
"selected"
);


if(
type ===
"Short Term Goal"
){

document
.getElementById("shortGoal")
.classList.add(
"selected"
);

}else{

document
.getElementById("longGoal")
.classList.add(
"selected"
);

}

}


/* =========================================================
   ADD REMINDER
========================================================= */

document
.getElementById("reminderForm")
.addEventListener(
"submit",
async function(e){

e.preventDefault();


const category =
document
.getElementById("category")
.value;


const goalType =
document
.getElementById("goalType")
.value;


if(
category ===
"Goal Planner" &&
!goalType
){

alert(
"Please select Goal Type."
);

return;

}


const data = {

type:
category,

title:
document
.getElementById("title")
.value
.trim(),

description:
document
.getElementById("description")
.value,

reminderDate:
document
.getElementById("date")
.value,

reminderTime:
document
.getElementById("time")
.value,

goalType:
goalType

};


try{

const response =
await fetch(
"/api/reminders",
{
method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:
JSON.stringify(data)
}
);


const result =
await response.json();


alert(result.message);


if(result.success){

document
.getElementById("reminderForm")
.reset();


document
.getElementById("goalBox")
.style.display =
"none";


document
.getElementById("goalType")
.value = "";


document
.getElementById("shortGoal")
.classList.remove(
"selected"
);


document
.getElementById("longGoal")
.classList.remove(
"selected"
);


loadReminders();

}

}catch(error){

alert(
"Unable to add reminder."
);

}

}
);


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value){

return String(value)

.replace(
/&/g,
"&amp;"
)

.replace(
/</g,
"&lt;"
)

.replace(
/>/g,
"&gt;"
)

.replace(
/"/g,
"&quot;"
)

.replace(
/'/g,
"&#039;"
);

}


/* =========================================================
   LOAD REMINDERS
========================================================= */

async function loadReminders(){

try{

const response =
await fetch(
"/api/reminders"
);


if(!response.ok){

return;

}


const result =
await response.json();


const container =
document.getElementById(
"reminders"
);


container.innerHTML = "";


if(
result.reminders.length === 0
){

container.innerHTML =
'<div class="reminder" ' +
'style="grid-column:1/-1;text-align:center;">' +

'<div style="font-size:45px;">🌸</div>' +

'<h3>No reminders yet</h3>' +

'<p>Add your first reminder above.</p>' +

'</div>';

return;

}


result.reminders.forEach(
function(reminder){

const card =
document.createElement(
"div"
);


card.className =
"reminder";


if(reminder.completed){

card.classList.add(
"completed"
);

}


let goalHTML = "";


if(reminder.goal_type){

goalHTML =
"<br>🎯 " +
escapeHTML(
reminder.goal_type
);

}


const completeText =
reminder.completed
? "↩ Undo"
: "✓ Complete";


card.innerHTML =

'<div class="reminder-category">' +

escapeHTML(
reminder.type
) +

'</div>' +

'<h3>' +

escapeHTML(
reminder.title
) +

'</h3>' +

'<div class="date-time">' +

'📅 ' +

escapeHTML(
reminder.reminder_date
) +

'<br>' +

'⏰ ' +

escapeHTML(
reminder.reminder_time
) +

goalHTML +

'</div>' +

'<div class="description">' +

escapeHTML(
reminder.description ||
"No description"
) +

'</div>' +

'<div class="actions">' +

'<button ' +
'class="complete-btn" ' +
'onclick="toggleReminder(' +
reminder.id +
')">' +

completeText +

'</button>' +

'<button ' +
'class="delete-btn" ' +
'onclick="deleteReminder(' +
reminder.id +
')">' +

'🗑 Delete' +

'</button>' +

'</div>';


container.appendChild(
card
);

}
);


}catch(error){

console.log(
"LOAD REMINDERS ERROR:",
error
);

}

}


/* =========================================================
   TOGGLE
========================================================= */

async function toggleReminder(id){

try{

await fetch(
"/api/reminders/" +
id +
"/toggle",
{
method:"PUT"
}
);


loadReminders();


}catch(error){

console.log(
"TOGGLE ERROR:",
error
);

}

}


/* =========================================================
   DELETE
========================================================= */

async function deleteReminder(id){

if(
!confirm(
"Delete this reminder?"
)
){

return;

}


try{

await fetch(
"/api/reminders/" +
id,
{
method:"DELETE"
}
);


loadReminders();


}catch(error){

console.log(
"DELETE ERROR:",
error
);

}

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout(){

try{

await fetch(
"/api/logout",
{
method:"POST"
}
);


location.reload();


}catch(error){

console.log(
"LOGOUT ERROR:",
error
);

}

}


/* =========================================================
   CHECK SESSION
========================================================= */

(async function(){

try{

const response =
await fetch(
"/api/me"
);


if(response.ok){

const result =
await response.json();


document
.getElementById("registerPage")
.classList.add("hidden");


document
.getElementById("loginPage")
.classList.add("hidden");


document
.getElementById("dashboard")
.classList.remove("hidden");


document
.getElementById("welcomeName")
.innerText =
result.user.name;


document
.getElementById("navName")
.innerText =
result.user.name;


loadReminders();


}else{

document
.getElementById("registerPage")
.classList.remove("hidden");

}


}catch(error){

document
.getElementById("registerPage")
.classList.remove("hidden");

}

})();

</script>

</body>

</html>`;


/* =========================================================
   WEBSITE ROUTE
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.send(HTML);

    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(`
/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(`
============================================================

       🌸 PERSONAL BUDDY STARTED 🌸

       Open:
       http://localhost:${PORT}

       Email Service:
       Resend

       Reminder Receiver:
       Registered User Email

============================================================
`);

    }
);
