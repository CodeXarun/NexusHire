import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const MONGODB_URI = process.env.MONGODB_URI!

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set in .env.local')

  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  // Dynamic import models after connection
  const { default: Job } = await import('../lib/models/Job')
  const { default: User } = await import('../lib/models/User')
  const { default: CompanyProfile } = await import('../lib/models/CompanyProfile')
  const { generateEmbedding } = await import('../lib/nim')

  // Clear existing seed data
  await Job.deleteMany({ companyName: 'Seed Corp' })
  console.log('Cleared old seed data')

  // Create sample recruiter
  let recruiter = await User.findOne({ email: 'recruiter@seedcorp.com' })
  if (!recruiter) {
    const bcrypt = await import('bcryptjs')
    recruiter = await User.create({
      name: 'Seed Recruiter',
      email: 'recruiter@seedcorp.com',
      passwordHash: await bcrypt.default.hash('password123', 10),
      role: 'recruiter',
      provider: 'credentials',
    })
    await CompanyProfile.create({
      userId: recruiter._id,
      companyName: 'Seed Corp',
      industry: 'Technology',
    })
    console.log('Created seed recruiter: recruiter@seedcorp.com / password123')
  }

  // Sample jobs
  const jobDefs = [
    {
      title: 'Senior Full-Stack Engineer',
      description: 'Build and scale our core platform. You will work on React frontend and Node.js backend services, with a focus on performance and reliability.',
      location: 'San Francisco, CA',
      locationType: 'hybrid',
      employmentType: 'full-time',
      roleLevel: 'senior',
      experienceRange: { min: 4, max: 8 },
      salaryRange: { min: 140000, max: 180000, currency: 'USD' },
      requiredSkills: [
        { skill: 'React', weight: 3, type: 'technical' },
        { skill: 'TypeScript', weight: 3, type: 'technical' },
        { skill: 'Node.js', weight: 2, type: 'technical' },
        { skill: 'PostgreSQL', weight: 2, type: 'technical' },
        { skill: 'System Design', weight: 2, type: 'domain' },
      ],
      cultureTags: ['fast-paced', 'collaborative', 'remote-friendly'],
    },
    {
      title: 'ML Engineer — LLM Applications',
      description: 'Build AI-powered products using large language models. Experience with fine-tuning, RAG, and production ML systems required.',
      location: 'Remote',
      locationType: 'remote',
      employmentType: 'full-time',
      roleLevel: 'mid',
      experienceRange: { min: 2, max: 6 },
      salaryRange: { min: 130000, max: 160000, currency: 'USD' },
      requiredSkills: [
        { skill: 'Python', weight: 3, type: 'technical' },
        { skill: 'LLMs', weight: 3, type: 'domain' },
        { skill: 'PyTorch', weight: 2, type: 'technical' },
        { skill: 'Vector Databases', weight: 2, type: 'tool' },
        { skill: 'RAG', weight: 3, type: 'domain' },
      ],
      cultureTags: ['research-oriented', 'autonomous', 'impact-driven'],
    },
    {
      title: 'Product Designer',
      description: 'Design delightful user experiences for our mobile and web products. You will own design from discovery to delivery.',
      location: 'New York, NY',
      locationType: 'onsite',
      employmentType: 'full-time',
      roleLevel: 'mid',
      experienceRange: { min: 3, max: 6 },
      salaryRange: { min: 100000, max: 130000, currency: 'USD' },
      requiredSkills: [
        { skill: 'Figma', weight: 3, type: 'tool' },
        { skill: 'User Research', weight: 2, type: 'domain' },
        { skill: 'Design Systems', weight: 3, type: 'domain' },
        { skill: 'Prototyping', weight: 2, type: 'technical' },
      ],
      cultureTags: ['design-led', 'user-centric', 'collaborative'],
    },
    {
      title: 'DevOps / Platform Engineer',
      description: 'Own our cloud infrastructure on AWS. Build CI/CD pipelines, improve observability, and ensure 99.9% uptime.',
      location: 'Austin, TX',
      locationType: 'hybrid',
      employmentType: 'full-time',
      roleLevel: 'senior',
      experienceRange: { min: 4, max: 10 },
      salaryRange: { min: 130000, max: 160000, currency: 'USD' },
      requiredSkills: [
        { skill: 'AWS', weight: 3, type: 'tool' },
        { skill: 'Kubernetes', weight: 3, type: 'tool' },
        { skill: 'Terraform', weight: 2, type: 'tool' },
        { skill: 'Docker', weight: 2, type: 'tool' },
        { skill: 'CI/CD', weight: 2, type: 'domain' },
      ],
      cultureTags: ['reliability-focused', 'on-call', 'automation-first'],
    },
    {
      title: 'Frontend Engineer — React Native',
      description: 'Build our mobile app with React Native. You will collaborate with design and backend teams to ship features for 1M+ users.',
      location: 'Remote',
      locationType: 'remote',
      employmentType: 'full-time',
      roleLevel: 'mid',
      experienceRange: { min: 2, max: 5 },
      salaryRange: { min: 100000, max: 130000, currency: 'USD' },
      requiredSkills: [
        { skill: 'React Native', weight: 3, type: 'technical' },
        { skill: 'TypeScript', weight: 3, type: 'technical' },
        { skill: 'iOS/Android', weight: 2, type: 'domain' },
        { skill: 'Redux', weight: 1, type: 'technical' },
      ],
      cultureTags: ['mobile-first', 'user-focused', 'async-friendly'],
    },
    {
      title: 'IoT & Embedded Systems Engineer',
      description: 'Design and develop firmware and IoT solutions. Work with microcontrollers, sensors, and cloud connectivity for smart devices.',
      location: 'Bangalore, India',
      locationType: 'hybrid',
      employmentType: 'full-time',
      roleLevel: 'mid',
      experienceRange: { min: 1, max: 4 },
      salaryRange: { min: 600000, max: 1200000, currency: 'INR' },
      requiredSkills: [
        { skill: 'C/C++', weight: 3, type: 'technical' },
        { skill: 'Arduino', weight: 2, type: 'tool' },
        { skill: 'Raspberry Pi', weight: 2, type: 'tool' },
        { skill: 'MQTT', weight: 2, type: 'domain' },
        { skill: 'Python', weight: 1, type: 'technical' },
      ],
      cultureTags: ['hardware-focused', 'innovative', 'fast-paced'],
    },
    {
      title: 'Full-Stack Web Developer (Next.js)',
      description: 'Build modern web applications with Next.js and TypeScript. Work on both frontend and backend using REST APIs and MongoDB.',
      location: 'Remote',
      locationType: 'remote',
      employmentType: 'full-time',
      roleLevel: 'mid',
      experienceRange: { min: 1, max: 3 },
      salaryRange: { min: 500000, max: 900000, currency: 'INR' },
      requiredSkills: [
        { skill: 'Next.js', weight: 3, type: 'technical' },
        { skill: 'TypeScript', weight: 2, type: 'technical' },
        { skill: 'MongoDB', weight: 2, type: 'tool' },
        { skill: 'Tailwind CSS', weight: 1, type: 'tool' },
        { skill: 'REST APIs', weight: 2, type: 'domain' },
      ],
      cultureTags: ['startup', 'collaborative', 'remote-first'],
    },
    // ── HIGH-MATCH JOBS (IoT + Next.js/TypeScript profile) ──────────────────
    {
      title: 'IoT Software Engineer — Smart Devices',
      description: 'Join our IoT team building smart device firmware and cloud-connected solutions. You will program microcontrollers, integrate sensors, build MQTT pipelines, and expose REST APIs consumed by our Next.js dashboard. Strong C/C++ and Python skills required. Experience with Arduino, Raspberry Pi, and ESP32 is a strong plus.',
      location: 'Bangalore, India',
      locationType: 'hybrid',
      employmentType: 'full-time',
      roleLevel: 'junior',
      experienceRange: { min: 0, max: 3 },
      salaryRange: { min: 400000, max: 900000, currency: 'INR' },
      requiredSkills: [
        { skill: 'C/C++', weight: 3, type: 'technical' },
        { skill: 'Python', weight: 3, type: 'technical' },
        { skill: 'Arduino', weight: 3, type: 'tool' },
        { skill: 'Raspberry Pi', weight: 3, type: 'tool' },
        { skill: 'MQTT', weight: 2, type: 'domain' },
        { skill: 'REST APIs', weight: 2, type: 'domain' },
        { skill: 'IoT', weight: 3, type: 'domain' },
      ],
      cultureTags: ['hardware-focused', 'innovative', 'startup'],
    },
    {
      title: 'Junior Full-Stack Developer — IoT Dashboard',
      description: 'Build and maintain the web dashboard for our IoT platform using Next.js and TypeScript. You will consume sensor data via REST APIs and WebSockets, visualise it with Chart.js, and store it in MongoDB. Bonus if you have hands-on IoT or embedded background — you will work directly with the firmware team.',
      location: 'Remote',
      locationType: 'remote',
      employmentType: 'full-time',
      roleLevel: 'junior',
      experienceRange: { min: 0, max: 2 },
      salaryRange: { min: 350000, max: 700000, currency: 'INR' },
      requiredSkills: [
        { skill: 'Next.js', weight: 3, type: 'technical' },
        { skill: 'TypeScript', weight: 3, type: 'technical' },
        { skill: 'React', weight: 3, type: 'technical' },
        { skill: 'MongoDB', weight: 2, type: 'tool' },
        { skill: 'REST APIs', weight: 2, type: 'domain' },
        { skill: 'IoT', weight: 2, type: 'domain' },
        { skill: 'Chart.js', weight: 1, type: 'tool' },
      ],
      cultureTags: ['startup', 'remote-first', 'product-led'],
    },
    {
      title: 'Embedded Systems & Python Developer',
      description: 'Design and implement Python-based firmware for embedded Linux boards including Raspberry Pi and Arduino. Integrate hardware peripherals, build MQTT and HTTP data bridges, and write clean Python scripts for sensor data acquisition pipelines. You will also write small REST microservices consumed by our web frontend.',
      location: 'Pune, India',
      locationType: 'hybrid',
      employmentType: 'full-time',
      roleLevel: 'junior',
      experienceRange: { min: 0, max: 2 },
      salaryRange: { min: 350000, max: 800000, currency: 'INR' },
      requiredSkills: [
        { skill: 'Python', weight: 3, type: 'technical' },
        { skill: 'Raspberry Pi', weight: 3, type: 'tool' },
        { skill: 'Arduino', weight: 3, type: 'tool' },
        { skill: 'MQTT', weight: 3, type: 'domain' },
        { skill: 'C/C++', weight: 2, type: 'technical' },
        { skill: 'REST APIs', weight: 2, type: 'domain' },
        { skill: 'IoT', weight: 3, type: 'domain' },
      ],
      cultureTags: ['hardware-focused', 'collaborative', 'fast-paced'],
    },
    {
      title: 'Software Engineer — IoT Platform (Next.js + Node.js)',
      description: 'Own the full stack of our IoT platform from device APIs in Node.js to the React and Next.js operator dashboard. You will design MQTT message schemas, build Mongoose models, write Tailwind CSS UI components, and implement real-time sensor data pipelines via WebSockets. Previous IoT or embedded project experience is highly valued.',
      location: 'Remote',
      locationType: 'remote',
      employmentType: 'full-time',
      roleLevel: 'mid',
      experienceRange: { min: 1, max: 4 },
      salaryRange: { min: 600000, max: 1200000, currency: 'INR' },
      requiredSkills: [
        { skill: 'Next.js', weight: 3, type: 'technical' },
        { skill: 'Node.js', weight: 3, type: 'technical' },
        { skill: 'TypeScript', weight: 3, type: 'technical' },
        { skill: 'MongoDB', weight: 2, type: 'tool' },
        { skill: 'MQTT', weight: 2, type: 'domain' },
        { skill: 'IoT', weight: 2, type: 'domain' },
        { skill: 'React', weight: 2, type: 'technical' },
        { skill: 'Tailwind CSS', weight: 1, type: 'tool' },
      ],
      cultureTags: ['remote-first', 'product-led', 'collaborative'],
    },
  ]


  // Generate embeddings for each job before inserting
  console.log(`Generating embeddings for ${jobDefs.length} jobs via NVIDIA NIM...`)
  const jobsWithEmbeddings = []
  for (const job of jobDefs) {
    const skillsText = job.requiredSkills.map((s) => s.skill).join(', ')
    const textBlob = `${job.title} ${skillsText} ${job.description}`
    let embedding: number[] = []
    try {
      embedding = await generateEmbedding(textBlob)
      process.stdout.write('.')
    } catch {
      console.warn(`\nEmbedding failed for: ${job.title}`)
    }
    jobsWithEmbeddings.push({
      ...job,
      recruiterId: recruiter._id,
      companyName: 'Seed Corp',
      status: 'active',
      embedding,
    })
    // Respect NIM rate limit (40 RPM)
    await new Promise((r) => setTimeout(r, 1600))
  }
  console.log('\nEmbeddings done.')

  const created = await Job.insertMany(jobsWithEmbeddings)
  console.log(`Created ${created.length} seed jobs`)
  console.log('Seed complete! Login with: recruiter@seedcorp.com / password123')

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
