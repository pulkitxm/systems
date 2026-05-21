import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'search-consumer',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({ 
  groupId: 'search-indexer-group' // Consumer group for search indexing
});

// Mock search index
const searchIndex: Map<string, any> = new Map();

async function indexInSearch(blogId: string, data: any) {
  // Simulate indexing in Elasticsearch (mock)
  console.log(`🔍 [SEARCH] Indexing blog ${blogId} in search engine...`);
  
  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 500));
  
  searchIndex.set(blogId, data);
  console.log(`✅ [SEARCH] Blog ${blogId} indexed successfully`);
  console.log(`📊 [SEARCH] Total blogs in index: ${searchIndex.size}\n`);
}

async function run() {
  await consumer.connect();
  console.log('🔍 Search Consumer connected to Kafka');
  console.log('👥 Consumer Group: search-indexer-group\n');

  await consumer.subscribe({ 
    topic: 'blog-published', 
    fromBeginning: true // Start from the beginning to process all messages
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value!.toString());
      
      console.log(`📨 [SEARCH] Received from partition ${partition}:`, {
        userId: event.userId,
        blogId: event.blogId,
        title: event.title,
      });

      // Process the message - index in search
      await indexInSearch(event.blogId, event);
    },
  });
}

run().catch(console.error);
