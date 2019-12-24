var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var middleware = require("../middleware");
var NodeGeocoder = require("node-geocoder");
var multer = require("multer");
var Review = require("../models/review");

var storage = multer.diskStorage({
	filename: function(req, file, callback) {
		callback(null, Date.now() + file.originalname);
	}
});
var imageFilter = function(req, file, cb) {
	// accept image files only
	if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
		return cb(new Error("Only image files are allowed!"), false);
	}
	cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter });

var cloudinary = require("cloudinary");
cloudinary.config({
	cloud_name: "hulbnigxa",
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET
});
var options = {
	provider: "google",
	httpAdapter: "https",
	apiKey: process.env.GEOCODER_API_KEY,
	formatter: null
};

var geocoder = NodeGeocoder(options);

//INDEX - show all campgrounds
router.get("/", function(req, res) {
	var perPage = 8;
	var pageQuery = parseInt(req.query.page);
	var pageNumber = pageQuery ? pageQuery : 1;
	var noMatch = null;
	if (req.query.search) {
		const regex = new RegExp(escapeRegex(req.query.search), "gi");
		Campground.find({ name: regex })
			.skip(perPage * pageNumber - perPage)
			.limit(perPage)
			.exec(function(err, allCampgrounds) {
				Campground.count({ name: regex }).exec(function(err, count) {
					if (err) {
						console.log(err);
						res.redirect("back");
					}
					else {
						if (allCampgrounds.length < 1) {
							noMatch = "No campgrounds match that query, please try again.";
						}
						res.render("campgrounds/index", {
							campgrounds: allCampgrounds,
							current: pageNumber,
							pages: Math.ceil(count / perPage),
							noMatch: noMatch,
							search: req.query.search
						});
					}
				});
			});
	}
	else {
		// get all campgrounds from DB
		Campground.find({}).skip(perPage * pageNumber - perPage).limit(perPage).exec(function(err, allCampgrounds) {
			Campground.count().exec(function(err, count) {
				if (err) {
					console.log(err);
				}
				else {
					res.render("campgrounds/index", {
						campgrounds: allCampgrounds,
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						noMatch: noMatch,
						search: false
					});
				}
			});
		});
	}
});

//create new camp
router.post("/", middleware.isLoggedIn, upload.single("image"), function(req, res) {
	if (req.file) {
		//Use upload Image function down below

		uploadImage(res, req);
	}
	else {
		//Use upload URL function down below

		uploadURL(req, res);
	}
});
//new form to creatd new camp
router.get("/new", middleware.isLoggedIn, function(req, res) {
	res.render("campgrounds/new");
});

//show info about camp
router.get("/:slug", function(req, res) {
	//find the campground with provided ID
	Campground.findOne({ slug: req.params.slug })
		.populate("comments")
		.populate({
			path: "reviews",
			options: { sort: { createdAt: -1 } }
		})
		.exec(function(err, foundCampground) {
			if (err || !foundCampground) {
				req.flash("error", "Campground not found");
				console.log(err);
				res.redirect("back");
			}
			else {
				//render show template
				res.render("campgrounds/show", { campground: foundCampground });
			}
		});
});

//Edit campground Route
router.get("/:slug/edit", middleware.checkCampgroundOwnership, function(req, res) {
	Campground.findOne({ slug: req.params.slug }, function(err, foundCampground) {
		if (err) {
			req.flash("error", err.message);
			res.redirect("/campgrounds");
		}
		else {
			res.render("campgrounds/edit", { campground: foundCampground });
		}
	});
});

// UPDATE CAMPGROUND ROUTE
router.put("/:slug", middleware.checkCampgroundOwnership, upload.single("image"), function(req, res) {
	geocoder.geocode(req.body.location, function(err, data) {
		if (err || !data.length) {
			console.log(err);
			req.flash("error", "Invalid address");
			return res.redirect("back");
		}
		req.body.lat = data[0].latitude;
		req.body.lng = data[0].longitude;
		req.body.location = data[0].formattedAddress;
		Campground.findOne({ slug: req.params.slug }, async function(err, campground) {
			if (err) {
				req.flash("error", err.message);
				return res.redirect("back");
			}
			else {
				if (req.file) {
					try {
						await cloudinary.v2.uploader.destroy(campground.imageId);
						var result = await cloudinary.v2.uploader.upload(req.file.path);

						campground.imageId = result.public_id;
						campground.image = result.secure_url;
					} catch (err) {
						req.flash("error", err.message);
						return res.redirect("back");
					}
				}
				else {
					campground.image = req.body.image;
				}
				campground.name = req.body.name;
				campground.description = req.body.description;
				campground.price = req.body.price;
				campground.lat = req.body.lat;
				campground.lng = req.body.lng;
				campground.location = req.body.location;
				await campground.save();
				req.flash("success", "Successfully Updated!");

				res.redirect("/campgrounds/" + campground.slug);
			}
		});
	});
});

//destroy campground route
router.delete("/:slug", middleware.checkCampgroundOwnership, function(req, res, next) {
	Campground.findOne({ slug: req.params.slug }, function(err, campground) {
		if (err) return next(err);
		cloudinary.v2.uploader.destroy(campground.imageId);
		campground.remove();
		req.flash("success", "Campground Deleted!");
		res.redirect("/campgrounds");
	});
});

function escapeRegex(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function uploadImage(res, req) {
	cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
		if (err) {
			req.flash("error", err.message);
		}
		geocoder.geocode(req.body.location, function(err, data) {
			if (err || !data.length) {
				req.flash("error", "Invalid address");
				return res.redirect("back");
			}

			var name = req.body.name;
			var image = result.secure_url;
			var imageId = result.public_id;
			var price = req.body.price;
			var desc = req.body.description;
			var author = {
				id: req.user._id,
				username: req.user.username
			};
			var lat = data[0].latitude;
			var lng = data[0].longitude;
			var location = data[0].formattedAddress;
			var newCampground = {
				name: name,
				image: image,
				imageId: imageId,
				price: price,
				description: desc,
				author: author,
				location: location,
				lat: lat,
				lng: lng
			};
			Campground.create(newCampground, function(err, newlyCreated) {
				if (err) {
					console.log(err);
					req.flash("error", "Campground coudn't be created!");
					return res.redirect("back");
				}
				else {
					//redirect back to campgrounds page
					console.log(newlyCreated);
					req.flash("success", "Campground Successfully Added!");
					res.redirect("/campgrounds");
				}
			});
		});
	});
}

function uploadURL(req, res) {
	geocoder.geocode(req.body.location, function(err, data) {
		if (err || !data.length) {
			req.flash("error", "Invalid address");
			return res.redirect("back");
		}
		var name = req.body.name;
		var image = req.body.image;
		var price = req.body.price;
		var desc = req.body.description;
		var author = {
			id: req.user._id,
			username: req.user.username
		};
		var lat = data[0].latitude;
		var lng = data[0].longitude;
		var location = data[0].formattedAddress;
		var newCampground = {
			name: name,
			image: image,
			price: price,
			description: desc,
			author: author,
			location: location,
			lat: lat,
			lng: lng
		};
		// Create a new campground and save to DB
		Campground.create(newCampground, function(err, newlyCreated) {
			if (err) {
				console.log(err);
				req.flash("error", "Campground coudn't be created!");
			}
			else {
				//redirect back to campgrounds page
				console.log(newlyCreated);
				req.flash("success", "Campground Successfully Added!");
				res.redirect("/campgrounds");
			}
		});
	});
}

module.exports = router;
