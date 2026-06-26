import { supabase } from './supabaseClient.js';

// Clean attachments: remove raw base64 data to avoid database bloating
export function sanitizeAttachmentMetadata(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.map(att => ({
    name: att.name || '',
    type: att.type || '',
    size: att.size || 0,
    url: att.url || null
  }));
}

export function sanitizeAudioMetadata(audio) {
  if (!audio) return null;
  return {
    type: 'audio',
    name: audio.name || '',
    mimeType: audio.mimeType || audio.type || '',
    size: audio.size || 0,
    durationSeconds: audio.durationSeconds || 0,
    url: audio.url || null
  };
}

export function sanitizeActionsMetadata(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map(act => ({
    id: act.id,
    type: act.type,
    status: act.status || 'pending',
    createdItemId: act.createdItemId || null,
    payload: act.payload || {}
  }));
}

export function mapLocalToRemoteMessage(localMsg, conversationId, userId) {
  const id = localMsg.id || crypto.randomUUID();
  
  return {
    id,
    user_id: userId,
    conversation_id: conversationId,
    role: localMsg.role,
    content: localMsg.content || '',
    attachments_meta: {
      attachments: sanitizeAttachmentMetadata(localMsg.attachments),
      audio: sanitizeAudioMetadata(localMsg.audio),
      actions: sanitizeActionsMetadata(localMsg.actions),
      timestamp: localMsg.timestamp || new Date().toISOString()
    },
    created_at: localMsg.timestamp || new Date().toISOString()
  };
}

export function mapRemoteToLocalMessage(remote) {
  const meta = remote.attachments_meta || {};
  return {
    id: remote.id,
    role: remote.role,
    content: remote.content || '',
    attachments: meta.attachments || [],
    audio: meta.audio || undefined,
    actions: meta.actions || [],
    timestamp: remote.created_at || meta.timestamp || new Date().toISOString()
  };
}

export function mapLocalToRemoteConversation(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    title: local.title || 'Nova Conversa',
    provider: local.provider || 'openai',
    model: local.model || 'gpt-4o',
    pinned: !!local.pinned,
    archived: !!local.archived,
    message_count: typeof local.messageCount === 'number' ? local.messageCount : (local.messages?.length || 0),
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: local.updatedAt || new Date().toISOString(),
    deleted_at: null
  };
}

export function mapRemoteToLocalConversation(remote, remoteMessages = []) {
  return {
    id: remote.id,
    title: remote.title || 'Nova Conversa',
    createdAt: remote.created_at || new Date().toISOString(),
    updatedAt: remote.updated_at || new Date().toISOString(),
    provider: remote.provider || 'openai',
    model: remote.model || 'gpt-4o',
    pinned: !!remote.pinned,
    archived: !!remote.archived,
    messageCount: remote.message_count || remoteMessages.length,
    messages: remoteMessages.map(mapRemoteToLocalMessage)
  };
}

// Load all non-deleted conversations and their messages from Supabase
export async function getAIConversations(user) {
  if (!user || !supabase) return [];
  
  try {
    const { data: convs, error: convsErr } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (convsErr) {
      console.error('[Lyria AI Sync] Fetch conversations error:', convsErr.message);
      return [];
    }

    if (!convs || convs.length === 0) return [];

    const { data: msgs, error: msgsErr } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (msgsErr) {
      console.error('[Lyria AI Sync] Fetch messages error:', msgsErr.message);
      return convs.map(c => mapRemoteToLocalConversation(c, []));
    }

    const messagesByConv = {};
    if (msgs) {
      msgs.forEach(m => {
        if (!messagesByConv[m.conversation_id]) {
          messagesByConv[m.conversation_id] = [];
        }
        messagesByConv[m.conversation_id].push(m);
      });
    }

    return convs.map(c => mapRemoteToLocalConversation(c, messagesByConv[c.id] || []));
  } catch (err) {
    console.error('[Lyria AI Sync] getAIConversations exception:', err);
    return [];
  }
}

// Upsert conversation details
export async function upsertAIConversation(user, conversation) {
  if (!user || !supabase) return false;
  try {
    const remote = mapLocalToRemoteConversation(conversation, user.id);
    const { error } = await supabase
      .from('ai_conversations')
      .upsert(remote, { onConflict: 'user_id,id' });

    if (error) {
      console.error('[Lyria AI Sync] Upsert conversation error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Lyria AI Sync] upsertAIConversation exception:', err);
    return false;
  }
}

// Upsert a list of messages for a conversation
export async function upsertAIMessages(user, conversationId, messages) {
  if (!user || !supabase || !messages || messages.length === 0) return false;
  try {
    const remote = messages.map(m => mapLocalToRemoteMessage(m, conversationId, user.id));
    const { error } = await supabase
      .from('ai_messages')
      .upsert(remote, { onConflict: 'user_id,id' });

    if (error) {
      console.error('[Lyria AI Sync] Upsert messages error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Lyria AI Sync] upsertAIMessages exception:', err);
    return false;
  }
}

// Soft delete a conversation
export async function deleteAIConversation(user, conversationId) {
  if (!user || !supabase) return false;
  try {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('id', conversationId);

    if (error) {
      console.error('[Lyria AI Sync] Delete conversation error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Lyria AI Sync] deleteAIConversation exception:', err);
    return false;
  }
}

// Idempotent migration of localStorage history to Supabase
export async function migrateLocalAIConversationsToSupabase(user, localConversations) {
  if (!user || !supabase || !Array.isArray(localConversations) || localConversations.length === 0) return false;
  
  console.log('[Lyria AI Sync] Starting local history migration to Supabase...');
  try {
    const { data: existingConvs, error: checkErr } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('user_id', user.id);

    if (checkErr) {
      console.error('[Lyria AI Sync] Failed to retrieve existing conversations for check:', checkErr.message);
      return false;
    }

    const existingIds = new Set((existingConvs || []).map(c => c.id));
    const toMigrateConvs = localConversations.filter(c => c && c.id && !existingIds.has(c.id));
    
    if (toMigrateConvs.length === 0) {
      console.log('[Lyria AI Sync] All local conversations are already synced or migration is caught up.');
      return true;
    }

    console.log(`[Lyria AI Sync] Migrating ${toMigrateConvs.length} new local conversations...`);
    const convsPayload = toMigrateConvs.map(c => mapLocalToRemoteConversation(c, user.id));
    
    const { error: convsErr } = await supabase
      .from('ai_conversations')
      .upsert(convsPayload, { onConflict: 'user_id,id' });

    if (convsErr) {
      console.error('[Lyria AI Sync] Migration of conversations failed:', convsErr.message);
      return false;
    }

    const msgsPayload = [];
    toMigrateConvs.forEach(c => {
      if (Array.isArray(c.messages)) {
        c.messages.forEach(m => {
          msgsPayload.push(mapLocalToRemoteMessage(m, c.id, user.id));
        });
      }
    });

    if (msgsPayload.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < msgsPayload.length; i += chunkSize) {
        const chunk = msgsPayload.slice(i, i + chunkSize);
        const { error: msgsErr } = await supabase
          .from('ai_messages')
          .upsert(chunk, { onConflict: 'user_id,id' });

        if (msgsErr) {
          console.error(`[Lyria AI Sync] Migration of messages chunk ${i}-${i + chunk.length} failed:`, msgsErr.message);
          return false;
        }
      }
    }

    console.log('[Lyria AI Sync] Local history migration completed successfully.');
    return true;
  } catch (err) {
    console.error('[Lyria AI Sync] Migration exception:', err);
    return false;
  }
}

// Clear all messages of a conversation
export async function clearAIMessages(user, conversationId) {
  if (!user || !supabase) return false;
  try {
    const { error } = await supabase
      .from('ai_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('[Lyria AI Sync] Clear messages error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Lyria AI Sync] clearAIMessages exception:', err);
    return false;
  }
}
