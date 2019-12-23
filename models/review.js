var mongoose = require("mongoose");

var reviewSchema = new mongoose.Schema(
	{
		rating: {
			type: Number,
			required: "Please provide a rating (1-5 stars).",
			min: 1,
			max: 5,
			validate: {
				// validator accepts a function definition which it uses for validation
				validator: Number.isInteger,
				message: "{VALUE} is not an integer"
			}
		},

		//review text
		text: {
			type: String
		},

		//author id and username field

		author: {
			id: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "User"
			},
			username: String
		},

		// campground asoociated with the review
		campground: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Campground"
		}
	},
	{
		// if timestamps are set to true, mongoose assigns createdAt and updatedAt fields to your schema, the type assigned is Date.
		timestamps: true
	}
);

module.exports = mongoose.model("Review", reviewSchema);
