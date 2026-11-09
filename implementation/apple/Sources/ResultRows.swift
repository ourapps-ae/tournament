// Rows of the final standings; text stays with the application.
public struct ResultPlayer {
    public let id: String
    public let name: String
    public let place: Int?
    public let isBot: Bool
    public let rebuysUsed: Int
    public let stack: Int
    public init(id: String, name: String, place: Int?, isBot: Bool, rebuysUsed: Int, stack: Int) {
        self.id = id; self.name = name; self.place = place; self.isBot = isBot; self.rebuysUsed = rebuysUsed; self.stack = stack
    }
}

public struct ResultRow: Equatable {
    public let id: String
    public let name: String
    public let place: Int?
    public let isYou: Bool
    public let isComputer: Bool
    public let rebought: Bool
    public let showStack: Bool
    public let stack: Int
}

// Placed players by place (ties keep their listed order), then those without a place.
public func resultRows(_ players: [ResultPlayer], you: String) -> [ResultRow] {
    // sorted(by:) is not guaranteed stable, so order by place then listed position.
    let ranked = players.enumerated().filter { $0.element.place != nil }
        .sorted { ($0.element.place!, $0.offset) < ($1.element.place!, $1.offset) }.map { $0.element }
    let unranked = players.filter { $0.place == nil }
    return (ranked + unranked).map { p in
        ResultRow(id: p.id, name: p.name, place: p.place, isYou: p.id == you, isComputer: p.isBot,
                  rebought: p.place != nil && p.rebuysUsed > 0, showStack: p.place == nil, stack: p.stack)
    }
}

public func headingKey(_ status: String) -> String { status == "cancelled" ? "cancelled_title" : "standings" }
