import dotenv from 'dotenv'

dotenv.config()

const CLIENT_ID = process.env.TICKTICK_CLIENT_ID || ''
const CLIENT_SECRET = process.env.TICKTICK_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.TICKTICK_REDIRECT_URI || 'http://localhost:3001/api/integrations/ticktick/callback'

export function getTickTickAuthUrl(state: string = ''): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: 'tasks:read tasks:write',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state
  })
  return `https://ticktick.com/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const clientId = (process.env.TICKTICK_CLIENT_ID || CLIENT_ID || '').trim()
  const clientSecret = (process.env.TICKTICK_CLIENT_SECRET || CLIENT_SECRET || '').trim()
  const redirectUri = (process.env.TICKTICK_REDIRECT_URI || REDIRECT_URI || '').trim()

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  // Method 1: Standard RFC 6749 Authorization Basic Header
  const params1 = new URLSearchParams()
  params1.append('code', code)
  params1.append('grant_type', 'authorization_code')
  params1.append('redirect_uri', redirectUri)

  let res = await fetch('https://ticktick.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: params1.toString()
  })

  let resText = await res.text()
  let data: any
  try {
    data = JSON.parse(resText)
  } catch (e) {
    data = { error: 'Invalid response from TickTick', error_description: resText.slice(0, 150) }
  }

  // Method 2 Fallback: Form body parameters
  if (!res.ok) {
    console.warn('[TickTick Auth Method 1 Failed, trying Method 2]:', data)
    const params2 = new URLSearchParams()
    params2.append('client_id', clientId)
    params2.append('client_secret', clientSecret)
    params2.append('code', code)
    params2.append('grant_type', 'authorization_code')
    params2.append('redirect_uri', redirectUri)

    res = await fetch('https://ticktick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params2.toString()
    })
    let resText2 = await res.text()
    try {
      data = JSON.parse(resText2)
    } catch (e) {
      data = { error: 'Invalid response from TickTick', error_description: resText2.slice(0, 150) }
    }
  }

  if (!res.ok) {
    console.error('[TickTick Token Exchange Failed Final]:', data)
    throw new Error(data.error_description || data.error || 'Failed to exchange authorization code for tokens')
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || '',
    expires_in: data.expires_in || 604800
  }
}

export async function refreshTickTickToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const clientId = (process.env.TICKTICK_CLIENT_ID || CLIENT_ID || '').trim()
  const clientSecret = (process.env.TICKTICK_CLIENT_SECRET || CLIENT_SECRET || '').trim()

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const params1 = new URLSearchParams()
  params1.append('grant_type', 'refresh_token')
  params1.append('refresh_token', refreshToken)

  let res = await fetch('https://ticktick.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: params1.toString()
  })

  let resText = await res.text()
  let data: any
  try {
    data = JSON.parse(resText)
  } catch (e) {
    data = { error: 'Invalid response from TickTick', error_description: resText.slice(0, 150) }
  }

  if (!res.ok) {
    const params2 = new URLSearchParams()
    params2.append('client_id', clientId)
    params2.append('client_secret', clientSecret)
    params2.append('grant_type', 'refresh_token')
    params2.append('refresh_token', refreshToken)

    res = await fetch('https://ticktick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params2.toString()
    })
    data = await res.json()
  }

  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh TickTick token')
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in || 604800
  }
}

export async function listTickTickProjects(accessToken: string): Promise<Array<{ id: string; name: string; color?: string }>> {
  const res = await fetch('https://api.ticktick.com/open/v1/project', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to list projects: ${errorText}`)
  }

  return await res.json()
}

export async function getOrCreateMarkbelProject(accessToken: string): Promise<string> {
  const projects = await listTickTickProjects(accessToken)
  const existing = projects.find(p => p.name.toLowerCase() === 'markbel')
  if (existing) {
    return existing.id
  }

  // Create new project
  const res = await fetch('https://api.ticktick.com/open/v1/project', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Markbel',
      color: '#00f0ff'
    })
  })

  if (!res.ok) {
    // If creation fails, default to first project or empty
    return projects[0]?.id || ''
  }

  const created = await res.json()
  return created.id
}

export async function createTickTickTask(
  accessToken: string,
  task: {
    title: string
    content?: string
    projectId?: string
    dueDate?: string
    priority?: number
  }
): Promise<any> {
  const body: any = {
    title: task.title,
    content: task.content || '',
    priority: task.priority ?? 0
  }

  if (task.projectId) {
    body.projectId = task.projectId
  }

  if (task.dueDate) {
    // Format YYYY-MM-DDTHH:mm:ss+0000 or ISO
    body.dueDate = new Date(task.dueDate).toISOString().replace('.000Z', '+0000')
  }

  const res = await fetch('https://api.ticktick.com/open/v1/task', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to create TickTick task: ${errorText}`)
  }

  return await res.json()
}

export async function getTickTickTask(
  accessToken: string,
  projectId: string,
  taskId: string
): Promise<any> {
  const res = await fetch(`https://api.ticktick.com/open/v1/project/${projectId}/task/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get TickTick task: ${errorText}`)
  }

  return await res.json()
}
