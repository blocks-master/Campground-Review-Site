var express = require("express");
var router = express.Router({ mergeParams: true });
var Campground = require("../models/campground");
var Review = require("../models/review");
var middleware = require("../middleware");
var Comment = require("../models/comment");

//review index
router.get("/", function(req, res) {
	Campground.findOne({ slug: req.params.slug })
		.populate({
			path: "reviews",
			options: { sort: { created: -1 } } // sorting the populated reviews array to show latest first
		})
		.exec(function(err, campground) {
			if (err || !campground) {
				req.flash("error", err.message);
				return res.redirect("back");
			}
			res.render("reviews/index", { campground: campground });
		});
});

//review new

router.get("/new", middleware.isLoggedIn, middleware.checkReviewExistence, function(req, res) {
	// middleware.checkReviewExistence checks if a user already reviewed the campground, only one review per user is allowed
	Campground.findOne({ slug: req.params.slug }, function(err, campground) {
		if (err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
		res.render("reviews/new", { campground: campground });
	});
});

//reviews created
router.post("/", middleware.isLoggedIn, middleware.checkReviewExistence, function(req, res) {
	//look up campground using slug
	Campground.findOne({ slug: req.params.slug }).populate("review").exec(function(err, campground) {
		if (err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
		else {
			Review.create(req.body.review, function(err, review) {
				if (err) {
					req.flash("error", err.message);
					return res.redirect("back");
				}
				else {
					// add author username/id and associated campground t the review
					review.author.id = req.user._id;
					review.author.username = req.user.username;
					review.campground = campground;

					//save review
					review.save();
					campground.reviews.push(review);
					campground.save();

					// calculate the new average review for the campground
					campground.rating = calculateAverage(campground.reviews);
					req.flash("success", "Your review has been successfully added.");
					res.redirect("/campgrounds/" + campground.slug);
				}
			});
		}
	});
});

//reviews edit

router.get("/:review_id/edit", middleware.checkReviewOwnership, function(req, res) {
	Review.findById(req.params.review_id, function(err, foundReview) {
		if (err) {
			req.flash("err", err.message);
			return res.redirect("back");
		}
		res.render("reviews/edit", { campground_slug: req.params.slug, review: foundReview });
	});
});

//reviews update

router.put("/:review_id", middleware.checkReviewOwnership, function(req, res) {
	Review.findByIdAndUpdate(req.params.review_id, req.body.review, { new: true }, function(err, updatedReview) {
		if (err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
		Campground.findOne({ slug: req.params.slug }).populate("reviews").exec(function(err, campground) {
			if (err) {
				req.flash("error", err.message);
				return res.redirect("back");
			}
			// recalculate campground average
			campground.rating = calculateAverage(campground.reviews);
			//save changes
			campground.save();
			req.flash("success", "Your review was successfully edited.");
			res.redirect("/campgrounds/" + campground.slug);
		});
	});
});

//review delete
router.delete("/:review_id", middleware.checkReviewOwnership, function(req, res) {
	Review.findByIdAndRemove(req.params.review_id, function(err) {
		if (err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
		Campground.findOneAndUpdate(
			{ slug: req.params.slug },
			{ $pull: { reviews: req.params.review_id } },
			{ new: true }
		)
			.populate("reviews")
			.exec(function(err, campground) {
				if (err) {
					req.flash("error", err.message);
					return res.redirect("back");
				}
				// recalculate campground average
				campground.rating = calculateAverage(campground.reviews);
				//save changes
				campground.save();
				req.flash("success", "Your review was deleted successfully.");
				res.redirect("/campgrounds/" + req.params.slug);
			});
	});
});

function calculateAverage(reviews) {
	if (reviews.length === 0) {
		return 0;
	}
	var sum = 0;
	reviews.forEach(function(element) {
		sum += element.rating;
	});
	return sum / reviews.length;
}

module.exports = router;
