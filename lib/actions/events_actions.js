"use server";
import { Event } from "../model/eventsModel";
import { connectToDb } from "../dbConnect";

// Add a new event
export const addEvent = async (formData) => {
  const { eventName, eventDate, eventTime, location, description } = formData;

  try {
    await connectToDb();
    const newEvent = new Event({
      eventName,
      eventDate,
      eventTime,
      location,
      description,
    });
    await newEvent.save();
    console.log("Event saved to database");
    return { success: true };
  } catch (error) {
    console.log("Error adding event:", error);
    return { error: error._message };
  }
};

// Get all events
export const getAllEvents = async () => {
  try {
    await connectToDb();
    const events = await Event.find();
    return events;
  } catch (error) {
    console.log("Error fetching events:", error);
    return { error: "Failed to retrieve events" };
  }
};

// Get a specific event by ID
export const getEventById = async (eventId) => {
  try {
    await connectToDb();
    const event = await Event.findById(eventId);
    if (!event) {
      return { error: "Event not found" };
    }
    return event;
  } catch (error) {
    console.log("Error fetching event by ID:", error);
    return { error: "Failed to retrieve event" };
  }
};

// Update an existing event
export const updateEvent = async (eventId, formData) => {
  const { eventName, eventDate, eventTime, location, description } = formData;

  try {
    await connectToDb();
    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      {
        eventName,
        eventDate,
        eventTime,
        location,
        description,
      },
      { new: true },
    );

    if (!updatedEvent) {
      return { error: "Event not found" };
    }

    console.log("Event updated in database");
    return { success: true, event: updatedEvent };
  } catch (error) {
    console.log("Error updating event:", error);
    return { error: "Failed to update event" };
  }
};

// Delete an event by ID
export const deleteEvent = async (eventId) => {
  try {
    await connectToDb();
    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (!deletedEvent) {
      return { error: "Event not found" };
    }

    console.log("Event deleted");
    return { success: true };
  } catch (error) {
    console.log("Error deleting event:", error);
    return { error: "Failed to delete event" };
  }
};
