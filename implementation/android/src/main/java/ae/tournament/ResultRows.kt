package ae.tournament

// Rows of the final standings; text stays with the application.
data class ResultPlayer(val id: String, val name: String, val place: Int?, val isBot: Boolean, val rebuysUsed: Int, val stack: Int)

data class ResultRow(val id: String, val name: String, val place: Int?, val isYou: Boolean, val isComputer: Boolean, val rebought: Boolean, val showStack: Boolean, val stack: Int)

// Placed players by place (sortedBy is stable, so ties keep their listed order), then those without a place.
fun resultRows(players: List<ResultPlayer>, you: String): List<ResultRow> {
    val ranked = players.filter { it.place != null }.sortedBy { it.place }
    val unranked = players.filter { it.place == null }
    return (ranked + unranked).map { p ->
        ResultRow(p.id, p.name, p.place, p.id == you, p.isBot, p.place != null && p.rebuysUsed > 0, p.place == null, p.stack)
    }
}

fun headingKey(status: String): String = if (status == "cancelled") "cancelled_title" else "standings"
