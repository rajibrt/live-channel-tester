-- Playback failure reporting indexes (event data is already stored in client_activity_events)

create index if not exists client_activity_events_type_time_idx
on public.client_activity_events(event_type, created_at desc);

create index if not exists client_activity_events_playback_channel_idx
on public.client_activity_events((event_data->>'channel_id'), created_at desc)
where event_type in ('playback_attempt', 'playback_failed');

