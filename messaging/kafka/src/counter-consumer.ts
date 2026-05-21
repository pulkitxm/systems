import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'counter-consumer',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({ 
  groupId: 'post-counter-group' // Different consumer group for counting
});

// Mock database for user post counts
const userPostCounts: Map<string, number> = new Map();

async function incrementPostCount(userId: string) {
  // Simulate updating database (mock)
  console.log(`📊 [COUNTER] Incrementing post count for user ${userId}...`);
  
  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const currentCount = userPostCounts.get(userId) || 0;
  userPostCounts.set(userId, currentCount + 1);
  
  console.log(`✅ [COUNTER] User ${userId} now has ${currentCount + 1} posts`);
  console.log(`📈 [COUNTER] All user counts:`, Object.fromEntries(userPostCounts));
  console.log('');
}

async function run() {
  await consumer.connect();
  console.log('📊 Counter Consumer connected to Kafka');
  console.log('👥 Consumer Group: post-counter-group\n');

  await consumer.subscribe({ 
    topic: 'blog-published', 
    fromBeginning: true // Start from the beginning to process all messages
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value!.toString());
      
      console.log(`📨 [COUNTER] Received from partition ${partition}:`, {
        userId: event.userId,
        blogId: event.blogId,
      });

      // Process the message - increment counter
      await incrementPostCount(event.userId);
    },
  });
}

run().catch(console.error);
