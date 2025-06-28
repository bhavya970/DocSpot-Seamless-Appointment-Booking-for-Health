const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Doctor = require("../models/doctorModel");
const User = require("../models/userModel");
const Appointment = require("../models/appointmentModel");
const moment = require("moment");

// Doctor Signup
exports.doctorSignup = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ email: req.body.email });
  if (doctor) {
    return next(
      new AppError("Doctor already applied. Please contact your clinic admin.", 400)
    );
  }

  const newDoctor = new Doctor({ ...req.body, status: "pending" });
  await newDoctor.save();

  const adminUser = await User.findOne({ isAdmin: true });
  adminUser.unseenNotifications.push({
    type: "new-doctor-request",
    message: `${newDoctor.fullName} has requested to join as a doctor.`,
    data: {
      doctorId: newDoctor._id,
      name: newDoctor.fullName,
    },
    onClickPath: "/admin/doctors",
  });

  await adminUser.save();

  res.status(200).send({
    status: true,
    message: "Doctor account applied successfully",
  });
});

// Get All Doctors
exports.getAllDoctors = catchAsync(async (req, res, next) => {
  const doctors = await Doctor.find();
  res.status(200).send({
    status: true,
    message: "All doctors fetched successfully",
    data: doctors,
  });
});

// Get Specific Doctor by userId
exports.getDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ userId: req.params.id });
  if (!doctor) return next(new AppError("Doctor not found", 404));

  res.status(200).send({
    status: true,
    message: "Doctor fetched successfully",
    data: doctor,
  });
});

// Update Doctor
exports.updateDoctor = catchAsync(async (req, res, next) => {
  const { body } = req.body;

  const doctor = await Doctor.findOneAndUpdate(
    { userId: req.params.id },
    body,
    { new: true }
  );

  if (!doctor) return next(new AppError("Doctor not found", 404));

  res.status(200).send({
    status: true,
    message: "Doctor updated successfully",
    data: doctor,
  });
});

// Get Approved Doctors Only
exports.getAllApprovedDoctors = catchAsync(async (req, res, next) => {
  const doctors = await Doctor.find({ status: "approved" });

  res.status(200).send({
    status: true,
    message: "All approved doctors fetched successfully",
    data: doctors,
  });
});

// Check Booking Availability
exports.checkBookingAvailability = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ userId: req.body.doctorId });
  if (!doctor) return next(new AppError("Doctor not found", 404));

  const doctorFromTime = moment(doctor.fromTime, "HH:mm");
  const doctorToTime = moment(doctor.toTime, "HH:mm");

  const selectedTime = moment(req.body.time, "HH:mm");
  const date = moment(req.body.date, "DD/MM/YYYY");
  const fromTime = moment(selectedTime).subtract(30, "minutes");
  const toTime = moment(selectedTime).add(15, "minutes");

  const displayFromTime = doctorFromTime.format("hh:mm A");
  const displayToTime = doctorToTime.format("hh:mm A");

  if (
    selectedTime.isBefore(doctorFromTime) ||
    selectedTime.isAfter(doctorToTime)
  ) {
    return next(
      new AppError(
        `Please select a time within the doctor's working hours ${displayFromTime} to ${displayToTime}`,
        400
      )
    );
  }

  const existingAppointments = await Appointment.find({
    doctorId: req.body.doctorId,
    date: date.format("DD/MM/YYYY"),
    time: { $gte: fromTime, $lte: toTime },
    status: { $ne: "rejected" },
  });

  if (existingAppointments.length > 0) {
    return next(new AppError("Appointment not available", 400));
  }

  res.status(200).send({
    status: true,
    message: "Appointment available",
  });
});

// Get All Appointments of a Doctor
exports.doctorAppointments = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ userId: req.params.id });
  if (!doctor) return next(new AppError("Doctor not found", 404));

  const appointments = await Appointment.find({ doctorId: doctor.userId });
  res.status(200).json({
    status: "success",
    message: "Appointments fetched successfully.",
    data: appointments,
  });
});

// Change Appointment Status
exports.changeAppointmentStatus = catchAsync(async (req, res, next) => {
  const { appointmentId, status } = req.body;

  const appointment = await Appointment.findByIdAndUpdate(appointmentId, {
    status,
  });

  if (!appointment) return next(new AppError("Appointment not found", 404));

  const user = await User.findById(appointment.userId);
  user.unseenNotifications.push({
    type: "appointment-status-changed",
    message: `Your appointment status has been ${status}`,
    data: {
      name: user.name,
    },
    onClickPath: "/appointments",
  });

  await user.save();

  res.status(200).send({
    status: true,
    message: "Appointment status changed successfully",
  });
});

// Get Approved Appointments of a Doctor
exports.getBookAppointments = catchAsync(async (req, res, next) => {
  const appointments = await Appointment.find({
    doctorId: req.params.id,
    status: "approved",
  });

  res.status(200).send({
    status: true,
    message: "Appointments fetched successfully",
    data: appointments,
  });
});




