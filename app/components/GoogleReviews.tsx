
"use client";

import React from "react";
import { Star } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

export type GoogleReview = {
  name: string;
  age: number;
  city: string;
  text: string;
  rating: number;
};
const REVIEWS: GoogleReview[] = [
  {
    name: "Rohit Sharma",
    age: 28,
    city: "Delhi",
    text: "I had early hair thinning around the temples and honestly I was just trying random products before this. The AI report actually explained why certain products were being recommended. I started with the routine and liked that the doctor changed my plan after reviewing progress. Hair fall reduction was noticeable after some weeks.",
    rating: 5,
  },
  {
    name: "Priya Menon",
    age: 33,
    city: "Kochi",
    text: "I was facing diffuse hair fall after stress and diet issues. Report was detailed and easy to understand. I liked that it wasn't only \"buy products\", they explained possible causes also. Regimen was simple to follow.",
    rating: 4,
  },
  {
    name: "Aman Verma",
    age: 25,
    city: "Lucknow",
    text: "Random oils aur serums try kar raha tha pehle 😅 AI Hair Analysis ne bata diya ki issue sirf hair fall nahi tha. Doctor support bhi kaafi helpful tha and routine time ke saath change bhi hua.",
    rating: 5,
  },
  {
    name: "Sneha Iyer",
    age: 29,
    city: "Bengaluru",
    text: "My concern was widening of the partition line. The report felt personalized and not generic. The nutrition + topical routine helped me stay consistent.",
    rating: 5,
  },
  {
    name: "Rajdeep Singh",
    age: 36,
    city: "Chandigarh",
    text: "Mid-stage hair loss tha aur honestly I was expecting some generic recommendations. Surprisingly, doctor consultation after assessment made a difference.",
    rating: 4,
  },
  {
    name: "Nikita Shah",
    age: 26,
    city: "Ahmedabad",
    text: "Stress ke wajah se sudden hair fall ho raha tha. The report actually highlighted lifestyle factors too. Felt more like a guided program than buying products.",
    rating: 5,
  },
  {
    name: "Harsh Gupta",
    age: 31,
    city: "Jaipur",
    text: "Good experience overall. The routine initially looked long but doctor simplified it later based on progress.",
    rating: 5,
  },
  {
    name: "Ayesha Khan",
    age: 24,
    city: "Hyderabad",
    text: "I liked the fact that I could choose between science-backed and nature-based options. Made me feel I wasn't being forced into one solution.",
    rating: 4,
  },
  {
    name: "Deepak Yadav",
    age: 39,
    city: "Patna",
    text: "Mujhe crown area thinning ka issue tha. Assessment ke baad routine mila aur doctor ne progress track karne bola. Kaafi structured laga.",
    rating: 5,
  },
  {
    name: "Megha Nair",
    age: 35,
    city: "Mumbai",
    text: "Liked the report design and explanation. I only felt the first routine looked slightly overwhelming but support team helped.",
    rating: 4,
  },
  {
    name: "Siddharth Jain",
    age: 27,
    city: "Pune",
    text: "The assessment actually picked up family history and stress factors. Felt much better than randomly ordering products online.",
    rating: 5,
  },
  {
    name: "Pooja Sinha",
    age: 42,
    city: "Kolkata",
    text: "Hormonal hair thinning tha. I liked that the doctor reviewed my journey and made small changes in the regimen over time.",
    rating: 5,
  },
  {
    name: "Abhishek Mishra",
    age: 30,
    city: "Indore",
    text: "Pehle laga AI wala normal gimmick hoga. But report kaafi detailed thi and product explanation helped.",
    rating: 4,
  },
  {
    name: "Shreya Das",
    age: 23,
    city: "Guwahati",
    text: "Hair damage from frequent styling and coloring. The nourish products recommended actually made sense for my issue.",
    rating: 5,
  },
  {
    name: "Vikram Nair",
    age: 44,
    city: "Chennai",
    text: "I was already in an advanced stage and the report recommended clinic consultation instead of pushing products only. Appreciated the honesty.",
    rating: 5,
  },
  {
    name: "Neha Kapoor",
    age: 37,
    city: "Delhi",
    text: "Doctor follow-ups every few weeks helped me continue the routine. Otherwise I usually stop after 1 month.",
    rating: 4,
  },
  {
    name: "Arjun Rao",
    age: 48,
    city: "Hyderabad",
    text: "I had already undergone hair transplant earlier and was looking for maintenance support. Assessment + doctor guidance helped with ongoing care.",
    rating: 5,
  },
  {
    name: "Kavya Patel",
    age: 28,
    city: "Surat",
    text: "Routine change hota raha progress ke according which I actually liked. Felt personalized rather than fixed.",
    rating: 5,
  },
  {
    name: "Manish Tiwari",
    age: 41,
    city: "Varanasi",
    text: "The complete program was easier than I expected. Initially thought cost would be high but kit pricing was better than buying separately.",
    rating: 4,
  },
  {
    name: "Ritu Arora",
    age: 32,
    city: "Noida",
    text: "Hair fall after lifestyle changes and poor sleep. Assessment picked those factors and doctor discussed them too.",
    rating: 5,
  },
  {
    name: "Karan Malhotra",
    age: 34,
    city: "Mumbai",
    text: "Random products nahi, proper plan chahiye tha 😄 AI report + doctor guidance combination kaafi useful laga. Progress tracking also kept me consistent.",
    rating: 5,
  },
];

export type GoogleReviewsProps = {
  reviews?: GoogleReview[];
  title?: string;
  className?: string;
};

export function GoogleReviews({
  reviews = REVIEWS,
  title = "What Our Clients Say",
  className = "",
}: GoogleReviewsProps) {
  return (
    <section className={`w-full py-8 sm:py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-center mb-6 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground text-center">
            {title}
          </h2>
        </div>

        <Swiper
          modules={[Autoplay, Pagination]}
          pagination={{ clickable: true }}
          autoplay={{ delay: 3000, disableOnInteraction: false }}
          loop={reviews.length > 3}
          spaceBetween={16}
          slidesPerView={1}
          breakpoints={{
            480: { slidesPerView: 1.25, spaceBetween: 16 },
            640: { slidesPerView: 1.75, spaceBetween: 20 },
            768: { slidesPerView: 2.2, spaceBetween: 24 },
            1024: { slidesPerView: 2.8, spaceBetween: 28 },
            1280: { slidesPerView: 3.15, spaceBetween: 32 },
          }}
          className="google-reviews-swiper !px-1 !pb-14 sm:!pb-16"
        >
          {reviews.map((review, index) => (
            <SwiperSlide key={`${review.name}-${index}`} className="!h-auto">
              <div className="box-border flex min-h-[300px] h-[330px] sm:h-[350px] md:h-[370px] w-full flex-col overflow-hidden rounded-2xl sm:rounded-[30px] border border-gray-200 bg-white p-5 sm:p-7 md:p-8 lg:p-9 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-4 sm:mb-6 flex items-center justify-between">
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 line-clamp-1">
                    {review.name}
                  </h3>
                  <span
                    aria-label="Google review"
                    className="bg-clip-text text-xl sm:text-2xl font-bold text-transparent shrink-0"
                    style={{
                      backgroundImage:
                        "conic-gradient(from -45deg, #4285F4 0deg 90deg, #34A853 90deg 180deg, #FBBC05 180deg 250deg, #EA4335 250deg 310deg, #4285F4 310deg)",
                    }}
                  >
                    G
                  </span>
                </div>

                <p className="line-clamp-5 text-sm sm:text-base md:text-lg leading-relaxed text-slate-600">
                  {review.text}
                </p>

                <div className="mt-auto flex items-center gap-2.5 sm:gap-3 pt-4 sm:pt-6">
                  <div className="flex text-teal-500" aria-label={`${review.rating} out of 5 stars`}>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`size-4 sm:size-5 md:size-6 ${
                          i < review.rating
                            ? "fill-teal-500 text-teal-500"
                            : "fill-gray-200 text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs sm:text-sm md:text-base text-slate-500 font-medium">
                    {review.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

export function AssessmentGoogleReviews({
  className,
}: {
  className?: string;
}) {
  return (
    <GoogleReviews
      reviews={REVIEWS}
      title="What Our Clients Say"
      className={className}
    />
  );
}

export default GoogleReviews;
