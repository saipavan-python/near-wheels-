// @ts-nocheck — Prisma Json string fields + SQLite insensitive handled at runtime
import { prisma } from "../db";

/**
 * Get nearby driving schools for a given location.
 */
export async function getNearbyDrivingSchools(
  lat: number,
  lng: number,
  radiusKm: number = 50,
  city?: string
) {
  // Haversine calculation using Prisma (since no PostGIS in SQLite)
  const schools = await prisma.drivingSchool.findMany({
    where: {
      status: "VERIFIED",
      isActive: true,
      ...(city ? { city: city } : {}),
    },
    include: {
      courses: {
        where: { isActive: true },
        select: { id: true, courseName: true, price: true, numLessons: true },
        take: 3,
      },
      reviews: {
        select: { rating: true },
      },
    },
    take: 50,
  });

  // Filter by distance using haversine formula (app-level, as per schema comment)
  const nearby = schools.filter((school) => {
    const distance = calculateDistance(lat, lng, school.lat, school.lng);
    return distance <= radiusKm;
  });

  // Sort by distance and return with computed fields
  return nearby
    .sort((a, b) => calculateDistance(lat, lng, a.lat, a.lng) - calculateDistance(lat, lng, b.lat, b.lng))
    .map((school) => {
      const reviews = (school as unknown as { reviews: { rating: number }[] }).reviews || [];
      const avgRating = reviews.length > 0 ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length : 0;
      const priceFrom = school.courses.length > 0 ? Math.min(...school.courses.map((c) => c.price)) : 0;
      const distance = calculateDistance(lat, lng, school.lat, school.lng);

      return {
        id: school.id,
        schoolName: school.schoolName,
        logoUrl: school.logoUrl,
        coverImageUrl: school.coverImageUrl,
        verified: school.status === "VERIFIED",
        rating: Math.round(avgRating * 10) / 10,
        ratingCount: reviews.length,
        distance,
        location: school.address,
        city: school.city,
        services: JSON.parse(school.servicesJson || "[]"),
        courses: school.courses.map((c) => ({
          name: c.courseName,
          price: c.price,
          numLessons: c.numLessons,
        })),
        priceFrom,
        status: school.status,
      };
    });
}

/**
 * Get driving school by ID with full details.
 */
export async function getDrivingSchoolById(id: string) {
  const school = await prisma.drivingSchool.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, phone: true } },
      courses: { where: { isActive: true } },
      vehicles: { where: { status: "ACTIVE" } },
      instructors: { where: { isActive: true } },
      galleries: true,
      reviews: { include: { student: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!school) return null;

  const avgRating = school.reviews.length > 0 ? school.reviews.reduce((sum, r) => sum + r.rating, 0) / school.reviews.length : 0;

  return {
    id: school.id,
    schoolName: school.schoolName,
    logoUrl: school.logoUrl,
    coverImageUrl: school.coverImageUrl,
    verified: school.status === "VERIFIED",
    rating: Math.round(avgRating * 10) / 10,
    ratingCount: school.reviews.length,
    ownerName: school.ownerName,
    phone: school.phone,
    email: school.email,
    description: school.description,
    address: school.address,
    area: school.area,
    city: school.city,
    state: school.state,
    pincode: school.pincode,
    lat: school.lat,
    lng: school.lng,
    establishedYear: school.establishedYear,
    services: JSON.parse(school.servicesJson || "[]"),
    completedLessons: school.completedLessons,
    totalStudents: school.totalStudents,
    courses: school.courses.map((c) => ({
      id: c.id,
      name: c.courseName,
      type: c.courseType,
      price: c.price,
      numLessons: c.numLessons,
      duration: c.lessonDuration,
      transmission: c.transmission,
      description: c.description,
    })),
    vehicles: school.vehicles.map((v) => ({
      id: v.id,
      brand: v.brand,
      model: v.model,
      type: v.vehicleType,
      transmission: v.transmission,
      year: v.year,
      imageUrl: v.imageUrl,
    })),
    instructors: school.instructors.map((i) => ({
      id: i.id,
      name: i.name,
      experience: i.experienceYears,
      languages: JSON.parse(i.languagesJson || "[]"),
      specialization: JSON.parse(i.specializationJson || "[]"),
      verification: i.verificationStatus,
    })),
    galleries: school.galleries.map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl,
      caption: g.caption,
    })),
    workingHours: JSON.parse(school.workingHoursJson || "{}"),
    reviews: school.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      studentName: r.student.name,
      createdAt: r.createdAt,
    })),
    status: school.status,
  };
}

/**
 * Search driving schools by filters.
 */
export async function searchDrivingSchools(
  filters: {
    city?: string;
    state?: string;
    courseType?: string;
    transmission?: "MANUAL" | "AUTOMATIC";
    lat?: number;
    lng?: number;
    radiusKm?: number;
    minRating?: number;
    maxPrice?: number;
  },
  page = 1,
  pageSize = 20
) {
  const skip = (page - 1) * pageSize;

  const whereConditions: any = {
    status: "VERIFIED",
    isActive: true,
  };

  if (filters.city) {
    whereConditions.city = filters.city;
  }
  if (filters.state) {
    whereConditions.state = filters.state;
  }

  const schools = await prisma.drivingSchool.findMany({
    where: whereConditions,
    include: {
      courses: {
        where: {
          isActive: true,
          transmission: filters.transmission ? { equals: filters.transmission } : undefined,
          courseType: filters.courseType ? { equals: filters.courseType } : undefined,
          price: filters.maxPrice ? { lte: filters.maxPrice } : undefined,
        },
      },
      reviews: {
        select: { rating: true },
      },
    },
    skip,
    take: pageSize,
  });

  // Filter by distance if lat/lng provided
  let filtered = schools;
  if (filters.lat && filters.lng && filters.radiusKm) {
    filtered = schools.filter((s) => {
      const dist = calculateDistance(filters.lat!, filters.lng!, s.lat, s.lng);
      return dist <= filters.radiusKm!;
    });
  }

  // Filter by rating if specified
  if (filters.minRating) {
    filtered = filtered.filter((s) => {
      const avgRating = s.reviews.length > 0 ? s.reviews.reduce((sum, r) => sum + r.rating, 0) / s.reviews.length : 0;
      return avgRating >= filters.minRating!;
    });
  }

  return filtered.map((s) => ({
    id: s.id,
    schoolName: s.schoolName,
    logoUrl: s.logoUrl,
    city: s.city,
    rating: s.ratingAvg,
    ratingCount: s.ratingCount,
    distance: filters.lat && filters.lng ? calculateDistance(filters.lat, filters.lng, s.lat, s.lng) : null,
    priceFrom: s.courses.length > 0 ? Math.min(...s.courses.map((c) => c.price)) : 0,
    services: JSON.parse(s.servicesJson || "[]"),
  }));
}

/**
 * Get driving courses by school ID.
 */
export async function getDrivingCoursesBySchool(schoolId: string) {
  return prisma.drivingCourse.findMany({
    where: { schoolId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get instructors by school ID.
 */
export async function getInstructorsBySchool(schoolId: string) {
  const instructors = await prisma.drivingInstructor.findMany({
    where: { schoolId, isActive: true },
  });

  return instructors.map((i) => ({
    ...i,
    languages: JSON.parse(i.languagesJson || "[]"),
    specialization: JSON.parse(i.specializationJson || "[]"),
    vehicleTypes: JSON.parse(i.vehicleTypeJson || "[]"),
  }));
}

/**
 * Haversine distance calculation in km.
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Create or update a driving booking.
 */
export async function createDrivingBooking(data: {
  studentId: string;
  schoolId: string;
  courseId: string;
  instructorId?: string;
  vehicleId?: string;
  scheduledDate?: Date;
  scheduledTime?: string;
  pickupLocation?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLocation?: string;
  dropLat?: number;
  dropLng?: number;
  totalAmount: number;
}) {
  // Generate booking code
  const code = `NW-DS-${Date.now().toString(36).toUpperCase()}`;

  const booking = await prisma.drivingBooking.create({
    data: {
      code,
      studentId: data.studentId,
      schoolId: data.schoolId,
      courseId: data.courseId,
      instructorId: data.instructorId,
      vehicleId: data.vehicleId,
      status: "PENDING",
      paymentStatus: "UNPAID",
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      pickupLocation: data.pickupLocation,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      dropLocation: data.dropLocation,
      dropLat: data.dropLat,
      dropLng: data.dropLng,
      baseAmount: data.totalAmount,
      totalAmount: data.totalAmount,
    },
  });

  return booking;
}

/**
 * Get booking by ID.
 */
export async function getDrivingBookingById(bookingId: string) {
  return prisma.drivingBooking.findUnique({
    where: { id: bookingId },
    include: {
      student: { select: { id: true, name: true, phone: true, email: true } },
      school: { select: { id: true, schoolName: true, phone: true } },
      course: { select: { id: true, courseName: true, price: true, numLessons: true } },
      instructor: { select: { id: true, name: true } },
      vehicle: { select: { id: true, brand: true, model: true } },
    },
  });
}

/**
 * Get bookings for a student.
 */
export async function getStudentDrivingBookings(studentId: string) {
  return prisma.drivingBooking.findMany({
    where: { studentId },
    include: {
      school: { select: { id: true, schoolName: true, logoUrl: true } },
      course: { select: { id: true, courseName: true } },
      instructor: { select: { id: true, name: true } },
      progress: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Update booking status.
 */
export async function updateDrivingBookingStatus(bookingId: string, status: string) {
  return prisma.drivingBooking.update({
    where: { id: bookingId },
    data: { status },
  });
}

/**
 * Create a driving review.
 */
export async function createDrivingReview(data: {
  bookingId?: string;
  studentId: string;
  schoolId: string;
  instructorId?: string;
  rating: number;
  comment?: string;
  instructorRating?: number;
  vehicleRating?: number;
  teachingRating?: number;
}) {
  return prisma.drivingReview.create({
    data,
  });
}

/**
 * Get reviews for a school.
 */
export async function getSchoolReviews(schoolId: string) {
  return prisma.drivingReview.findMany({
    where: { schoolId },
    include: {
      student: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
