import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'blog-producer',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();

interface BlogPublishedEvent {
  userId: string;
  blogId: string;
  title: string;
  timestamp: string;
}

async function publishBlog(userId: string, blogId: string, title: string) {
  const event: BlogPublishedEvent = {
    userId,
    blogId,
    title,
    timestamp: new Date().toISOString(),
  };

  await producer.send({
    topic: 'blog-published',
    messages: [
      {
        key: userId, // Partition key - all messages from same user go to same partition
        value: JSON.stringify(event),
      },
    ],
  });

  console.log(`✅ Published blog: "${title}" by user ${userId}`);
}

async function run() {
  await producer.connect();
  console.log('📤 Producer connected to Kafka\n');

  // Publish ONE random blog
  const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
  const randomUser = users[Math.floor(Math.random() * users.length)];
  const randomId = Math.floor(Math.random() * 10000);
  const blogId = `blog-${randomId}`;
  const title = `Random Blog Post #${randomId}`;
  
  await publishBlog(randomUser, blogId, title);

  console.log('\n✨ Blog published! Run again to publish another random blog.');
  console.log('💡 Tip: Same userId will always go to the same partition\n');
  
  await producer.disconnect();
}

run().catch(console.error);
