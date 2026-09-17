-- Single-node advisory lease only; never a physical-control or durable DB lock.
if #KEYS ~= 1 or #ARGV ~= 1 or ARGV[1] == '' then
  return redis.error_reply('INVALID_LEASE_ARGUMENTS')
end
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
