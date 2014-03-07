require 'rubygems'
require 'time'
# require 'debugger'
require 'json'
require 'digest'

module RailsLogLine
  class Request < Struct.new(:start_at, :format, :client_ip, :http_method, :action_label, :parameters_raw, :session_id, :user, :finish_at, :processing_time, :response_status, :url, :incomplete)
    def finished?
      finish_at
    end

    def serialize_hash
      to_h.merge('identifier' => identifier, 'color' => color)
    end

    def identifier
      Digest::MD5.hexdigest(JSON.dump(self.to_h))
    end

    def color
      return '#e6550d' if response_status == 500
      return '#fdae6b' if self.incomplete
      '#3182bd'
    end

    def to_h
      Hash[each_pair.to_a]
    end
  end

  class Reboot < Struct.new(:at)
    def start_at
      self.at
    end

    def serialize_hash
      to_h.merge("identifier" => Digest::MD5.hexdigest("#{at} server reboot"), "description" => 'Server reboot', 'color' => '#000')
    end

    def to_h
      Hash[each_pair.to_a]
    end

  end

  class LogEntry
    attr_reader :time, :worker_id, :content
    def initialize(time, worker_id, content)
      @time, @worker_id, @content = time, worker_id, content
    end

    def to_s
      "#{@time} #{@worker_id}: #{@content}"
    end
  end

  class LogParser
    def self.parse(log_content)
      extract_events(extract_entries(log_content))
    end

    def self.extract_entries(log_content)
      ret = []
      merge_rsyslog_wrapping(encoding_convert(log_content).gsub("\n\n", ' ')).each_line do |l|
        if l =~ /\[([0-9\-\s:,]+)\]\s\[([^\]]*)\]\s\[[^\]]*\]\s\[[^\]]*\]\s(.*)$/
          # $1 is time, $2 is thread id, $3 is log content
          ret << LogEntry.new(DateTime.parse($1), $2, $3)
        end
      end
      ret
    end

    def self.extract_events(entries)
      requests = []
      reboots = []
      entries.group_by(&:worker_id).each do |_, es|
        current_req = nil
        es.each do |entry|
          entry_content = entry.content.strip

          # puts  "#{entry.time} #{entry_content}"
          if entry_content =~ /Processing (\w+)#(\w+) ([\w\s]*)\(for ([\d\.]+) at .*\) \[(\w+)\]$/
            controller = $1
            action = $2
            requests << current_req if current_req
            current_req = Request.new
            current_req.start_at = entry.time
            current_req.format = $3 =~ /\s*/ ? "html" : $3
            current_req.client_ip = $4
            current_req.http_method = $5
            current_req.action_label = controller.gsub(/Controller$/, " ") + action

          elsif entry_content =~ /^Parameters: ({.*})$/
            if current_req
              current_req.parameters_raw = $1
            end
          elsif entry_content =~ /\[grok:session_id:([^\]]+)\]/
            if current_req
              current_req.session_id = $1
            end
          elsif entry_content =~ /\[grok:user:([^\]]+)\]/
            if current_req
              current_req.user = $1
            end
          elsif entry_content =~ /^Completed in (\d+)ms \([^\|]+\| (\d+) [^\[]+\[(.*)$/
            if current_req
              current_req.finish_at = entry.time
              current_req.processing_time = $1
              current_req.response_status = $2
              current_req.url = $3

              requests << current_req
              current_req = nil
            end
          elsif entry_content == 'Rendering errors/not_found (404)' || entry_content == "404 displayed"
            if current_req
              current_req.finish_at = entry.time
              current_req.processing_time = nil
              current_req.response_status = '404'
              current_req.url = nil

              requests << current_req
              current_req = nil
            end
          elsif entry_content =~ /but was not authorized$/
            if current_req
              current_req.finish_at = entry.time
              current_req.processing_time = nil
              current_req.response_status = '403'
              current_req.url = nil

              requests << current_req
              current_req = nil
            end
          elsif entry_content == 'Rendering errors/unknown (500)'
            if current_req
              current_req.finish_at = entry.time
              current_req.processing_time = nil
              current_req.response_status = 500
              current_req.url = nil

              requests << current_req
              current_req = nil
            end
          elsif entry_content =~ /^Redirected to http/
            if current_req
              current_req.finish_at = entry.time
              current_req.processing_time = nil
              current_req.response_status = 302
              current_req.url = nil
              requests << current_req
              current_req = nil
            end
          elsif entry_content =~ /Logging to org\.slf4j\.impl.Log4jLoggerAdapter/
            reboots << Reboot.new(entry.time)
          end

        end
      end
      post_processing(requests, reboots)
    end

    def self.post_processing(requests, reboots)
      requests.each do |req|
        if !req.finish_at
          req.incomplete = true
          if reboot = reboots.detect { |r| req.start_at < r.at }
            req.finish_at = reboot.at
          end
        end
      end

      (requests + reboots).sort_by { |event| event.start_at }
    end


    def self.merge_rsyslog_wrapping(content)
      content.gsub!(/\.\.\.[^.]*\.\.\./, '')
      content
    end

    def self.encoding_convert(log)
      log.force_encoding("ISO-8859-1").encode("utf-8", replace: nil)
    end
  end
end


if ARGV[0]
  events = RailsLogLine::LogParser.parse(File.read(ARGV[0]))
  puts JSON.dump(events.map { |event| event.serialize_hash })
end
