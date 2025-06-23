const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to calculate duration
function calculateDuration(startDate, endDate, isAllDay) {
  if (isAllDay) return { hours: 24, minutes: 0 };
  
  const diffMs = new Date(endDate) - new Date(startDate);
  const diffMins = Math.floor((diffMs / 1000) / 60);
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;
  
  return { hours, minutes };
}

// GET all events
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let where = {};

    if (startDate && endDate) {
      where = {
        OR: [
          // Events that start within the date range
          {
            startDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          // Events that span across the date range
          {
            startDate: { lt: new Date(startDate) },
            endDate: { gt: new Date(endDate) },
          },
          // Events that end within the date range
          {
            endDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
        ],
      };
    }

    const events = await prisma.events.findMany({
      where,
      orderBy: {
        startDate: 'asc',
      },
    });

    // Add duration to each event
    const eventsWithDuration = events.map(event => ({
      ...event,
      duration: calculateDuration(event.startDate, event.endDate || event.startDate, event.isAllDay),
    }));

    res.json(eventsWithDuration);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET single event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.events.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      ...event,
      duration: calculateDuration(event.startDate, event.endDate || event.startDate, event.isAllDay),
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST create new event
router.post('/', async (req, res) => {
  try {
    const { title, description, startDate, endDate, isAllDay } = req.body;
    
    // Basic validation
    if (!title || !startDate) {
      return res.status(400).json({ error: 'Title and start date are required' });
    }

    const event = await prisma.events.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: isAllDay ? null : new Date(endDate),
        isAllDay: Boolean(isAllDay),
      },
    });

    res.status(201).json({
      ...event,
      duration: calculateDuration(event.startDate, event.endDate || event.startDate, event.isAllDay),
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(400).json({ error: 'Failed to create event' });
  }
});

// PUT/PATCH update event
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, isAllDay } = req.body;

    // Check if event exists
    const existingEvent = await prisma.events.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const updatedEvent = await prisma.events.update({
      where: { id: parseInt(id) },
      data: {
        title: title || existingEvent.title,
        description: description !== undefined ? description : existingEvent.description,
        startDate: startDate ? new Date(startDate) : existingEvent.startDate,
        endDate: isAllDay ? null : (endDate ? new Date(endDate) : existingEvent.endDate),
        isAllDay: isAllDay !== undefined ? Boolean(isAllDay) : existingEvent.isAllDay,
      },
    });

    res.json({
      ...updatedEvent,
      duration: calculateDuration(updatedEvent.startDate, updatedEvent.endDate || updatedEvent.startDate, updatedEvent.isAllDay),
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(400).json({ error: 'Failed to update event' });
  }
});

// DELETE event
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event exists
    const existingEvent = await prisma.events.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await prisma.events.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(400).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;