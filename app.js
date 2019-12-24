require("dotenv").config();
var express = require("express"),
	app = express(),
	bodyParser = require("body-parser"),
	mongoose = require("mongoose"),
	flash = require("connect-flash");
(Campground = require("./models/campground")),
	(seedDB = require("./seeds")),
	(Comment = require("./models/comment")),
	(passport = require("passport")),
	(LocalStrategy = require("passport-local")),
	(User = require("./models/user")),
	(methodOverride = require("method-override"));
//require routes
var commentRoutes = require("./routes/comments"),
	reviewRoutes = require("./routes/reviews"),
	campgroundRoutes = require("./routes/campgrounds"),
	indexRoutes = require("./routes/index");

mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("useUnifiedTopology", true);
mongoose.connect(
	"mongodb+srv://jklong93:baolong06@yelpcamp-diar9.azure.mongodb.net/yelp_camp?retryWrites=true&w=majority"
);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(methodOverride("_method"));

app.use(flash());
// seedDB(); //seed the database
app.locals.moment = require("moment");
//passport config
app.use(
	require("express-session")({
		secret: "Once again Yuni is the cutest",
		resave: false,
		saveUninitialized: false
	})
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next) {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.use(indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:slug/comments", commentRoutes);
app.use("/campgrounds/:slug/reviews", reviewRoutes);

var port = process.env.PORT || 3000;
app.listen(port, function() {
	console.log("Server Has Started!");
});
